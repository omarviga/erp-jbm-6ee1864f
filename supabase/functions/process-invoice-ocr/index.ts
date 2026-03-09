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
    // --- AUTH & ROLE CHECK ---
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

    // Check role: only admin or almacen
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const allowedRoles = ["admin", "almacen"];
    if (!roles?.some((r: { role: string }) => allowedRoles.includes(r.role))) {
      return new Response(
        JSON.stringify({ error: "No autorizado: requiere rol admin o almacen" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- BUSINESS LOGIC ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { imageBase64, fileName } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Se requiere la imagen de la factura" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payload size guard: ~5MB base64 limit
    if (typeof imageBase64 === "string" && imageBase64.length > 5_000_000) {
      return new Response(
        JSON.stringify({ error: "La imagen excede el tamaño máximo permitido (5MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Gemini's vision capabilities to extract invoice data
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
            content: `Eres un experto en procesamiento de facturas de compras de insumos para un empaque de limón. 
Extrae la información de la factura y devuelve ÚNICAMENTE un JSON con la siguiente estructura:
{
  "proveedor": "nombre del proveedor",
  "numero_factura": "número o folio de la factura",
  "fecha": "YYYY-MM-DD",
  "subtotal": 0.00,
  "iva": 0.00,
  "total": 0.00,
  "insumos": [
    {
      "nombre": "nombre del insumo",
      "tipo_insumo": "tipo (caja_plastica|arpilla|tarima|esquinero|fleje|cera|caja_carton)",
      "cantidad": 0,
      "precio_unitario": 0.00,
      "subtotal": 0.00
    }
  ]
}

Los tipos de insumo válidos son: caja_plastica, arpilla, tarima, esquinero, fleje, cera, caja_carton.
Si el insumo no coincide con ninguno, usa el más cercano o "caja_plastica" como default.
Responde SOLO con el JSON, sin explicaciones adicionales.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza esta imagen de factura de compra de insumos y extrae toda la información relevante. Archivo: ${fileName || 'factura'}`
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
        max_tokens: 2000,
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
      console.error("AI gateway error:", response.status);
      throw new Error(`Error del servicio de IA: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No se pudo extraer información de la factura");
    }

    // Parse the JSON response from AI
    let invoiceData;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      invoiceData = JSON.parse(cleanContent);
    } catch (_parseError) {
      console.error("Error parsing AI response");
      throw new Error("No se pudo interpretar la respuesta del análisis");
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: invoiceData
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("OCR processing error:", error instanceof Error ? error.message : "Unknown");
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
