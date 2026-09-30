import { moneda, type FormaPagoBascula } from "./calculos";

/** Ancho de papel térmico del ticket. */
export type AnchoTicket = "80mm" | "58mm";

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
