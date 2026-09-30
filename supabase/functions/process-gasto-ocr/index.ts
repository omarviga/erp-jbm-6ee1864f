import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const allowedRoles = ["admin", "finanzas"];
    if (!roles?.some((r: { role: string }) => allowedRoles.includes(r.role))) {
      return new Response(
        JSON.stringify({ error: "No autorizado: requiere rol admin o finanzas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { imageBase64, fileName } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Se requiere la imagen del ticket" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof imageBase64 === "string" && imageBase64.length > 5_000_000) {
      return new Response(
        JSON.stringify({ error: "La imagen excede el tamaño máximo permitido (5MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Eres un experto en procesamiento de tickets de compra, notas de remisión y comprobantes de gastos para un empaque de limón.
Extrae la información y devuelve ÚNICAMENTE un JSON con esta estructura:
{
  "concepto": "descripción breve del gasto",
  "categoria": "mantenimiento|viaticos|combustible|papeleria|limpieza|refacciones|servicios|otros",
  "monto": 0.00,
  "proveedor": "nombre del proveedor o establecimiento",
  "numero_ticket": "número de ticket o folio",
  "fecha": "YYYY-MM-DD"
}

Las categorías válidas son: mantenimiento, viaticos, combustible, papeleria, limpieza, refacciones, servicios, otros.
Si no puedes determinar la categoría, usa "otros".
Responde SOLO con el JSON, sin explicaciones adicionales.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza esta imagen de ticket/comprobante de gasto y extrae toda la información relevante. Archivo: ${fileName || 'ticket'}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA agotados. Contacta al administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Error del servicio de IA: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No se pudo extraer información del ticket");
    }

    let ticketData;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      ticketData = JSON.parse(cleanContent);
    } catch {
      throw new Error("No se pudo interpretar la respuesta del análisis");
    }

    return new Response(
      JSON.stringify({ success: true, data: ticketData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
