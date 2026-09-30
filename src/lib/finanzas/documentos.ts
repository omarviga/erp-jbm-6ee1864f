// Documentos oficiales de Finanzas — JBM Cítricos ERP.
// Sin dependencias: los PDF se emiten vía ventana de impresión del navegador
// (el cajero elige "Guardar como PDF") y Excel vía CSV con BOM.
// Si el repo adopta jspdf/xlsx, estas funciones son el punto de reemplazo.

import { formatoKilos, formatoPesos } from "../recepcion/calculos";
import type { TotalesLiquidacion } from "./calculos";

export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Descarga CSV compatible con Excel (BOM UTF-8 + comillas). */
export function exportarCsv(
  nombreArchivo: string,
  encabezados: string[],
  filas: (string | number)[][],
): void {
  const celda = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv =
    "\uFEFF" +
    [encabezados, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.endsWith(".csv")
    ? nombreArchivo
    : `${nombreArchivo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Abre la ventana de impresión membretada (destino: impresora o PDF). */
export function abrirVentanaImpresion(titulo: string, cuerpoHtml: string): void {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${escaparHtml(titulo)}</title>
<style>
body{font-family:Arial,sans-serif;color:#0f172a;margin:24px;font-size:12px}
.membrete{text-align:center;border-bottom:3px solid #047857;padding-bottom:8px;margin-bottom:12px}
.membrete h1{margin:0;font-size:18px}.membrete p{margin:2px 0;color:#475569}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left}
th{background:#0f172a;color:#fff;font-size:11px}
.num{text-align:right;font-variant-numeric:tabular-nums}
.total{background:#fef3c7;font-weight:bold}
.firmas{display:flex;gap:40px;margin-top:48px}
.firmas div{flex:1;border-top:1px solid #0f172a;padding-top:4px;text-align:center}
@media print{body{margin:0}.noprint{display:none}}
</style></head><body>${cuerpoHtml}
<script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}

// ---------------------------------------------------------------------------
// Boleta Oficial de Liquidación en PDF
// ---------------------------------------------------------------------------

export interface BoletaPdfRow {
  folioBascula: string;
  fechaEntrada: string;
  pesoBruto: number;
  pesoTara: number;
  kilosNetos: number;
  precioKg: number;
  anticipos: number;
  descuentoBascula: number;
  deduccionOperativa: number;
  saldoNeto: number;
}

export interface DatosBoletaLiquidacion {
  folioLiquidacion: string;
  fecha: string;
  productorDisplay: string;
  boletas: BoletaPdfRow[];
  totales: TotalesLiquidacion;
  pagadorNombre: string;
}

export function generarHtmlBoletaLiquidacion(d: DatosBoletaLiquidacion): string {
  const filas = d.boletas
    .map(
      (b) => `<tr>
<td>${escaparHtml(b.folioBascula)}</td><td>${escaparHtml(b.fechaEntrada)}</td>
<td class="num">${formatoKilos(b.pesoBruto)}</td><td class="num">${formatoKilos(b.pesoTara)}</td>
<td class="num">${formatoKilos(b.kilosNetos)}</td><td class="num">${formatoPesos(b.precioKg)}</td>
<td class="num">-${formatoPesos(b.descuentoBascula)}</td>
<td class="num">-${formatoPesos(b.deduccionOperativa)}</td>
<td class="num">${formatoPesos(b.saldoNeto)}</td></tr>`,
    )
    .join("");
  const t = d.totales;
  return `<div class="membrete"><h1>JBM CÍTRICOS PREMIUM</h1>
<p>Boleta Oficial de Liquidación a Productores — Folio ${escaparHtml(d.folioLiquidacion)}</p>
<p>Fecha: ${escaparHtml(d.fecha)}</p></div>
<p><strong>Productor beneficiario:</strong> ${escaparHtml(d.productorDisplay)}</p>
<p><strong>Boletas procesadas:</strong> ${t.nBoletas} &nbsp; <strong>Kilos netos totales:</strong> ${formatoKilos(t.kilosNetos)} &nbsp; <strong>Precio promedio:</strong> ${formatoPesos(t.precioPromedio)}/kg</p>
<table><thead><tr><th>Folio báscula</th><th>Fecha</th><th>Bruto</th><th>Tara</th><th>Netos</th><th>Precio/kg</th><th>Báscula</th><th>Ded. oper.</th><th>Saldo boleta</th></tr></thead>
<tbody>${filas}</tbody></table>
<table><tbody>
<tr><td>Subtotal Fruta Bruta</td><td class="num">${formatoPesos(t.subtotalFruta)}</td></tr>
<tr><td>(−) Anticipos amortizados</td><td class="num">-${formatoPesos(t.anticipos)}</td></tr>
<tr><td>(−) Deducción báscula</td><td class="num">-${formatoPesos(t.deduccionBascula)}</td></tr>
<tr><td>(−) Deducción operativa por kilo</td><td class="num">-${formatoPesos(t.deduccionOperativa)}</td></tr>
<tr class="total"><td>IMPORTE TOTAL NETO A PAGAR</td><td class="num">${formatoPesos(t.totalNeto)}</td></tr>
</tbody></table>
<div class="firmas"><div>Productor (conformidad)</div><div>Pagador / Administración — ${escaparHtml(d.pagadorNombre)}</div></div>`;
}

export function generateSettlementPdf(d: DatosBoletaLiquidacion): void {
  abrirVentanaImpresion(
    `Liquidación ${d.folioLiquidacion}`,
    generarHtmlBoletaLiquidacion(d),
  );
}

// ---------------------------------------------------------------------------
// Estado de Cuenta Oficial del productor en PDF
// ---------------------------------------------------------------------------

export interface MovimientoCuenta {
  fecha: string;
  concepto: string;
  referencia: string;
  kilos: number;
  cargos: number;
  abonos: number;
}

export interface DatosEstadoCuenta {
  productorDisplay: string;
  periodo: string;
  movimientos: MovimientoCuenta[];
  kilosEntregados: number;
  precioPromedio: number;
  pagosDispersados: number;
  porLiquidar: number;
}

export function generarHtmlEstadoCuenta(d: DatosEstadoCuenta): string {
  const filas = d.movimientos
    .map(
      (m) => `<tr><td>${escaparHtml(m.fecha)}</td><td>${escaparHtml(m.concepto)}</td>
<td>${escaparHtml(m.referencia)}</td><td class="num">${m.kilos ? formatoKilos(m.kilos) : "—"}</td>
<td class="num">${m.cargos ? formatoPesos(m.cargos) : "—"}</td>
<td class="num">${m.abonos ? formatoPesos(m.abonos) : "—"}</td></tr>`,
    )
    .join("");
  return `<div class="membrete"><h1>JBM CÍTRICOS PREMIUM</h1>
<p>Estado de Cuenta Oficial de Productor — ${escaparHtml(d.periodo)}</p></div>
<p><strong>Productor:</strong> ${escaparHtml(d.productorDisplay)}</p>
<p><strong>Kilos entregados:</strong> ${formatoKilos(d.kilosEntregados)} &nbsp;
<strong>Precio promedio:</strong> ${formatoPesos(d.precioPromedio)}/kg &nbsp;
<strong>Pagos dispersados:</strong> ${formatoPesos(d.pagosDispersados)} &nbsp;
<strong>Por liquidar:</strong> ${formatoPesos(d.porLiquidar)}</p>
<table><thead><tr><th>Fecha</th><th>Concepto</th><th>Referencia</th><th>Kilos</th><th>Cargos</th><th>Abonos</th></tr></thead>
<tbody>${filas}</tbody></table>
<div class="firmas"><div>Productor (conformidad)</div><div>Administración JBM</div></div>`;
}

export function generateProducerAccountStatementPdf(d: DatosEstadoCuenta): void {
  abrirVentanaImpresion(
    `Estado de cuenta ${d.productorDisplay}`,
    generarHtmlEstadoCuenta(d),
  );
}

// ---------------------------------------------------------------------------
// Reporte de deducción operativa en PDF
// ---------------------------------------------------------------------------

export interface FilaReporteDeduccion {
  productorDisplay: string;
  nBoletas: number;
  kilosNetos: number;
  deduccion: number;
}

export interface FilaDetalleReporte {
  fecha: string;
  ticket: string;
  productorDisplay: string;
  kilosNetos: number;
  precioKg: number;
  subtotal: number;
  deduccion: number;
  bascula: number;
  neto: number;
}

export function generarHtmlReporteDeduccion(
  periodo: string,
  filas: FilaReporteDeduccion[],
  total: number,
  kilos: number,
  detalle: FilaDetalleReporte[] = [],
): string {
  const cuerpo = filas
    .map(
      (f) => `<tr><td>${escaparHtml(f.productorDisplay)}</td>
<td class="num">${f.nBoletas}</td><td class="num">${formatoKilos(f.kilosNetos)}</td>
<td class="num">${formatoPesos(f.deduccion)}</td></tr>`,
    )
    .join("");
  const cuerpoDetalle = detalle
    .map(
      (f) => `<tr><td>${escaparHtml(f.fecha)}</td><td>${escaparHtml(f.ticket)}</td>
<td>${escaparHtml(f.productorDisplay)}</td>
<td class="num">${formatoKilos(f.kilosNetos)}</td><td class="num">${formatoPesos(f.precioKg)}</td>
<td class="num">${formatoPesos(f.subtotal)}</td><td class="num">-${formatoPesos(f.deduccion)}</td>
<td class="num">-${formatoPesos(f.bascula)}</td><td class="num">${formatoPesos(f.neto)}</td></tr>`,
    )
    .join("");
  const seccionDetalle =
    detalle.length === 0
      ? ""
      : `<h2>Detalle por ticket</h2>
<table><thead><tr><th>Fecha</th><th>Ticket</th><th>Productor</th><th>Kilos</th><th>Precio</th><th>Subtotal</th><th>Deducción</th><th>Báscula</th><th>Neto</th></tr></thead>
<tbody>${cuerpoDetalle}</tbody></table>`;
  return `<div class="membrete"><h1>JBM CÍTRICOS PREMIUM</h1>
<p>Consolidado de Deducción Operativa — ${escaparHtml(periodo)}</p></div>
<table><thead><tr><th>Productor</th><th>Boletas</th><th>Kilos</th><th>Deducción</th></tr></thead>
<tbody>${cuerpo}</tbody></table>
<p><strong>Total periodo:</strong> ${formatoPesos(total)} &nbsp; <strong>Kilos:</strong> ${formatoKilos(kilos)}</p>
${seccionDetalle}`;
}
