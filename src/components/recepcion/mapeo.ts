import type { DatosRecepcion } from "@/hooks/useRecepcion";
import { VARIEDAD_UNICA } from "@/lib/recepcion/calculos";
import type { RecepcionPayload } from "./types";

/**
 * Convierte el payload del modal "Nueva Boleta" al formato que espera
 * guardarRecepcion. La boleta rápida es compra a terceros sin calidad
 * ni cortadores: defectos 0, dictamen aceptado.
 */
export function payloadADatosRecepcion(payload: RecepcionPayload): DatosRecepcion {
  return {
    productor_id: payload.productorId,
    huerto_id: null,
    es_cosecha_propia: false,
    origen: "externo",
    peso_bruto: payload.pesoBruto,
    peso_tara: payload.pesoTara,
    precio_pactado_kg: payload.precioKg,
    precio_caja_cortador: 0,
    zona_asignada: "linea_produccion",
    costo_bascula: payload.cuotaBascula,
    bascula_forma_pago: payload.formaPagoBascula,
    cuota_maniobra_kg: payload.tarifaManiobraKg,
    cuota_maniobra_concepto: payload.conceptoManiobra,
    operador_bascula: payload.operadorBascula,
    folio_fisico: payload.folioBascula,
    variedad: VARIEDAD_UNICA,
    calidad_defectos: 0,
    estado_calidad: "aceptado",
    notas: "",
    cortadores: [],
    anticipos: payload.anticipos,
    tipo_pago_recepcion: payload.tipoPagoRecepcion,
  };
}
