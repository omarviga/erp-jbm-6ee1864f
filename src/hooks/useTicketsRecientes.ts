import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { importeDeduccionCongelado } from "@/lib/finanzas/mapeo";
import { redondear2 } from "@/lib/recepcion/calculos";

/** Ticket reciente con los importes leídos del lote guardado. */
export interface TicketReciente {
  id: string;
  numeroLote: string;
  folioRecepcion: string | null;
  folioFisico: string | null;
  fechaRecepcion: string;
  productorId: string | null;
  productorNombre: string;
  esCosechaPropia: boolean;
  estadoCalidad: string | null;
  pesoBruto: number;
  pesoTara: number;
  pesoNeto: number;
  kilosMerma: number;
  defectosPct: number;
  precioKg: number;
  subtotal: number;
  costoBascula: number;
  basculaFormaPago: "liquidacion" | "efectivo";
  basculaDescontada: number;
  cuotaManiobraKg: number;
  cuotaManiobraConcepto: string;
  cuotaManiobraTotal: number;
  totalDeducciones: number;
  total: number;
  precioNetoEfectivo: number;
  operadorBascula: string;
  variedad: string;
}

interface FilaLoteReciente {
  id: string;
  numero_lote: string;
  folio_recepcion: string | null;
  folio_fisico: string | null;
  fecha_recepcion: string;
  productor_id: string | null;
  es_cosecha_propia: boolean | null;
  estado_calidad: string | null;
  peso_bruto: number;
  peso_tara: number;
  peso_neto: number | null;
  kilos_merma: number | null;
  calidad_defectos: number | null;
  precio_pactado_kg: number | null;
  costo_bascula: number | null;
  bascula_forma_pago: string;
  cuota_maniobra_kg: number;
  cuota_maniobra_concepto: string | null;
  cuota_maniobra_total: number;
  operador_bascula: string | null;
  variedad: string | null;
  productores: { nombre: string } | { nombre: string }[] | null;
}

const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** Mapea una fila de lote al modelo de la lista (valores congelados). */
export function filaATicketReciente(f: FilaLoteReciente): TicketReciente {
  const pesoNeto = num(f.peso_neto);
  const precioKg = num(f.precio_pactado_kg);
  const subtotal = redondear2(pesoNeto * precioKg);
  const basculaFormaPago =
    f.bascula_forma_pago === "efectivo" ? "efectivo" : "liquidacion";
  const basculaDescontada =
    basculaFormaPago === "liquidacion" ? num(f.costo_bascula) : 0;
  const cuotaManiobraTotal = importeDeduccionCongelado(
    pesoNeto,
    f.cuota_maniobra_kg,
    f.cuota_maniobra_total,
  );
  const totalDeducciones = redondear2(basculaDescontada + cuotaManiobraTotal);
  const total = Math.max(0, redondear2(subtotal - totalDeducciones));
  const productor = Array.isArray(f.productores) ? f.productores[0] : f.productores;
  return {
    id: f.id,
    numeroLote: f.numero_lote,
    folioRecepcion: f.folio_recepcion,
    folioFisico: f.folio_fisico,
    fechaRecepcion: f.fecha_recepcion,
    productorId: f.productor_id,
    productorNombre: productor?.nombre?.trim() || "SIN ASIGNAR",
    esCosechaPropia: f.es_cosecha_propia === true,
    estadoCalidad: f.estado_calidad,
    pesoBruto: num(f.peso_bruto),
    pesoTara: num(f.peso_tara),
    pesoNeto,
    kilosMerma: num(f.kilos_merma),
    defectosPct: num(f.calidad_defectos),
    precioKg,
    subtotal,
    costoBascula: num(f.costo_bascula),
    basculaFormaPago,
    basculaDescontada,
    cuotaManiobraKg: num(f.cuota_maniobra_kg),
    cuotaManiobraConcepto: f.cuota_maniobra_concepto ?? "",
    cuotaManiobraTotal,
    totalDeducciones,
    total,
    precioNetoEfectivo: pesoNeto > 0 ? redondear2(total / pesoNeto) : 0,
    operadorBascula: f.operador_bascula ?? "",
    variedad: f.variedad ?? "",
  };
}

/** Últimos tickets registrados, más recientes primero. */
export function useTicketsRecientes(limite = 15) {
  const {
    data: tickets = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["recepcion", "tickets-recientes", limite],
    queryFn: async (): Promise<TicketReciente[]> => {
      const { data, error } = await supabase
        .from("lotes")
        .select(
          "id, numero_lote, folio_recepcion, folio_fisico, fecha_recepcion, productor_id, es_cosecha_propia, estado_calidad, peso_bruto, peso_tara, peso_neto, kilos_merma, calidad_defectos, precio_pactado_kg, costo_bascula, bascula_forma_pago, cuota_maniobra_kg, cuota_maniobra_concepto, cuota_maniobra_total, operador_bascula, variedad, productores:productor_id (nombre)",
        )
        .order("fecha_recepcion", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return ((data ?? []) as unknown as FilaLoteReciente[]).map(
        filaATicketReciente,
      );
    },
  });

  return { tickets, loading, error };
}
