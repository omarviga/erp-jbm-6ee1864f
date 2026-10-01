import { moneda, type FormaPagoBascula } from "./calculos";

/** Ancho de papel térmico del ticket. */
export type AnchoTicket = "80mm" | "58mm";

/** 80 mm ≈ 302 px y 58 mm ≈ 219 px a 96 dpi. */
export const ANCHO_PAPEL_PX: Record<AnchoTicket, number> = {
  "80mm": 302,
  "58mm": 219,
};

/** Copia texto al portapapeles con respaldo para navegadores sin API. */
export async function copiarTextoTicket(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
    } else {
      const area = document.createElement("textarea");
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    return true;
  } catch {
    return false;
  }
}

/** Portal público del productor para consultar estatus de pago y PDF. */
export const PORTAL_STATUS_BASE = "https://portal.jbmcitricos.com/status";

/** URL de validación en línea del ticket (QR + mensajes). */
export function urlConsultaPago(
  folioOficial: string,
  respaldo?: string
): string {
  const folio = (folioOficial ?? "").trim();
  if (folio) return `${PORTAL_STATUS_BASE}/${folio.toLowerCase()}`;
  return (respaldo ?? "").trim();
}

/** Subconjunto del ticket necesario para el resumen de texto. */
export interface ResumenTicket {
  folioOficial: string;
  folioFisico: string;
  numeroLote: string;
  productor: string;
  huerto: string;
  pesoBruto: number;
  tara: number;
  pesoNeto: number;
  precioKg: number;
  subtotal: number;
  costoBascula: number;
  basculaFormaPago: FormaPagoBascula;
  cuotaManiobraKg: number;
  cuotaManiobra: number;
  totalDeducciones: number;
  total: number;
  precioNetoEfectivo: number;
  fecha: string;
  origen?: string;
  variedad?: string;
  operador?: string;
  statusUrl?: string;
}

const kilos = (valor: number): string =>
  `${valor.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;

/**
 * Resumen en texto plano del ticket de báscula, listo para copiar y
 * enviar al productor por WhatsApp o SMS (*neg cursivas* estilo WhatsApp).
 */
export function formatearResumenWhatsApp(ticket: ResumenTicket): string {
  const lineas = [
    `*JBM Cítricos — Boleta de recepción ${ticket.folioOficial || "POR ASIGNAR"}*`,
    ticket.fecha,
    `Productor: ${ticket.productor}`,
    ticket.huerto && ticket.huerto !== "—" ? `Huerto: ${ticket.huerto}` : null,
    ticket.numeroLote ? `Lote: ${ticket.numeroLote}` : null,
    ticket.folioFisico ? `Ticket báscula: ${ticket.folioFisico}` : null,
    `Bruto: ${kilos(ticket.pesoBruto)} · Tara: ${kilos(ticket.tara)}`,
    `*Neto: ${kilos(ticket.pesoNeto)}* × ${moneda(ticket.precioKg)} = ${moneda(ticket.subtotal)}`,
  ];

  if (ticket.costoBascula > 0) {
    lineas.push(
      ticket.basculaFormaPago === "efectivo"
        ? `Báscula (efectivo, no deducida): ${moneda(ticket.costoBascula)}`
        : `Báscula (deducción): -${moneda(ticket.costoBascula)}`
    );
  }

  if (ticket.cuotaManiobra > 0) {
    lineas.push(
      `Maniobra (${moneda(ticket.cuotaManiobraKg)}/kg): -${moneda(ticket.cuotaManiobra)}`
    );
  }

  lineas.push(
    `Deducciones: -${moneda(ticket.totalDeducciones)}`,
    `*Total neto: ${moneda(ticket.total)}* (${moneda(ticket.precioNetoEfectivo)}/kg)`
  );

  return lineas.filter((linea): linea is string => linea !== null).join("\n");
}

/**
 * Resumen estructurado con emojis para el botón Compartir/WhatsApp del
 * historial: mismo números que `formatearResumenWhatsApp` más origen,
 * variedad, operador y liga de consulta de pago.
 */
export function formatearResumenCompartirBoleta(ticket: ResumenTicket): string {
  const folio = ticket.folioOficial || "POR ASIGNAR";
  const lineas: (string | null)[] = [
    `🧾 *JBM CÍTRICOS — Ticket ${ticket.folioFisico || folio}*`,
    `📄 Folio ERP: ${folio}`,
    `📅 ${ticket.fecha}`,
    `👤 Productor: ${ticket.productor}`,
    ticket.variedad ? `🌱 Variedad: ${ticket.variedad}` : null,
    ticket.numeroLote ? `🔖 Lote: ${ticket.numeroLote}` : null,
    `⚖️ Bruto: ${kilos(ticket.pesoBruto)} · Tara: ${kilos(ticket.tara)}`,
    `✅ *Neto: ${kilos(ticket.pesoNeto)}* × ${moneda(ticket.precioKg)} = ${moneda(ticket.subtotal)}`,
  ];

  if (ticket.costoBascula > 0) {
    lineas.push(
      ticket.basculaFormaPago === "efectivo"
        ? `🏷️ Báscula (PAGADO EF.): ${moneda(0)}`
        : `🏷️ Cuota báscula (DESCUENTO): -${moneda(ticket.costoBascula)}`
    );
  }

  if (ticket.cuotaManiobra > 0) {
    lineas.push(
      `🚚 Cargos op. (${moneda(ticket.cuotaManiobraKg)}/kg): -${moneda(ticket.cuotaManiobra)}`
    );
  }

  lineas.push(`💰 *TOTAL A LIQUIDAR: ${moneda(ticket.total)}* (${moneda(ticket.precioNetoEfectivo)}/kg)`);

  const url = urlConsultaPago(ticket.folioOficial, ticket.statusUrl);
  if (url) lineas.push(`🔗 Consulta tu pago: ${url}`);
  if (ticket.operador) lineas.push(`👷 Operador: ${ticket.operador}`);
  lineas.push("¡Gracias por su preferencia! 🍋");

  return lineas.filter((linea): linea is string => linea !== null).join("\n");
}
