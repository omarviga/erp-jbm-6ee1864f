import ExcelJS from "exceljs";
import { COMPANY_INFO } from "@/lib/company";
import type { FilaDetalleTicket } from "@/lib/finanzas/mapeo";

export interface DeduccionExcelFila {
  productor: string;
  boletas: number;
  kilos: number;
  deduccion: number;
}

const COLOR = {
  verde: "16A34A",
  slate: "1F2937",
  grisTexto: "6B7280",
  grisFondo: "F8FAFC",
  ambar: "FEF3C7",
  borde: "E5E7EB",
  blanco: "FFFFFF",
} as const;

const CURRENCY = '"$"#,##0.00';
const NUMBER = "#,##0.00";
const ENTERO = "#,##0";

export async function descargarDeduccionExcel(
  periodo: string,
  filas: DeduccionExcelFila[],
  detalle: FilaDetalleTicket[] = [],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JBM ERP";
  workbook.created = new Date();

  if (filas.length === 0 && detalle.length === 0) return;

  const hoja = workbook.addWorksheet("Deducción operativa");
  hoja.columns = [
    { width: 38 },
    { width: 12 },
    { width: 16 },
    { width: 20 },
  ];

  hoja.mergeCells("A1:D1");
  const titulo = hoja.getCell("A1");
  titulo.value = `${COMPANY_INFO.displayName} — Consolidado de Deducción Operativa`;
  titulo.font = { size: 14, bold: true, color: { argb: COLOR.slate } };

  hoja.mergeCells("A2:D2");
  const subt = hoja.getCell("A2");
  subt.value = `Periodo: ${periodo}`;
  subt.font = { size: 11, color: { argb: COLOR.grisTexto } };

  const head = hoja.getRow(4);
  head.values = ["Productor", "Boletas", "Kilos netos", "Deducción operativa"];
  head.font = { bold: true, color: { argb: COLOR.blanco } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.slate } };

  let r = 5;
  for (const f of filas) {
    const row = hoja.getRow(r);
    row.values = [f.productor, f.boletas, f.kilos, f.deduccion];
    row.getCell(2).numFmt = ENTERO;
    row.getCell(3).numFmt = NUMBER;
    row.getCell(4).numFmt = CURRENCY;
    if (r % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.grisFondo } };
    }
    r += 1;
  }

  const tot = hoja.getRow(r);
  tot.values = [
    "Total periodo",
    filas.reduce((s, f) => s + f.boletas, 0),
    filas.reduce((s, f) => s + f.kilos, 0),
    filas.reduce((s, f) => s + f.deduccion, 0),
  ];
  tot.font = { bold: true };
  tot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.ambar } };
  tot.getCell(2).numFmt = ENTERO;
  tot.getCell(3).numFmt = NUMBER;
  tot.getCell(4).numFmt = CURRENCY;

  if (detalle.length > 0) {
    const det = workbook.addWorksheet("Detalle tickets");
    det.columns = [
      { width: 13 },
      { width: 16 },
      { width: 38 },
      { width: 14 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 16 },
    ];
    det.mergeCells("A1:I1");
    const tituloDet = det.getCell("A1");
    tituloDet.value = `${COMPANY_INFO.displayName} — Detalle por Ticket`;
    tituloDet.font = { size: 14, bold: true, color: { argb: COLOR.slate } };
    det.mergeCells("A2:I2");
    const subtDet = det.getCell("A2");
    subtDet.value = `Periodo: ${periodo}`;
    subtDet.font = { size: 11, color: { argb: COLOR.grisTexto } };

    const headDet = det.getRow(4);
    headDet.values = ["Fecha", "Ticket", "Productor", "Kilos", "Precio", "Subtotal", "Deducción", "Báscula", "Neto"];
    headDet.font = { bold: true, color: { argb: COLOR.blanco } };
    headDet.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.slate } };

    let rd = 5;
    for (const f of detalle) {
      const row = det.getRow(rd);
      row.values = [f.fecha.slice(0, 10), f.ticket, f.productorDisplay, f.kilosNetos, f.precioKg, f.subtotal, f.deduccion, f.bascula, f.neto];
      row.getCell(4).numFmt = NUMBER;
      row.getCell(5).numFmt = CURRENCY;
      row.getCell(6).numFmt = CURRENCY;
      row.getCell(7).numFmt = CURRENCY;
      row.getCell(8).numFmt = CURRENCY;
      row.getCell(9).numFmt = CURRENCY;
      if (rd % 2 === 1) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.grisFondo } };
      }
      rd += 1;
    }

    const totDet = det.getRow(rd);
    totDet.values = [
      "Total periodo",
      "",
      "",
      detalle.reduce((s, f) => s + f.kilosNetos, 0),
      "",
      detalle.reduce((s, f) => s + f.subtotal, 0),
      detalle.reduce((s, f) => s + f.deduccion, 0),
      detalle.reduce((s, f) => s + f.bascula, 0),
      detalle.reduce((s, f) => s + f.neto, 0),
    ];
    totDet.font = { bold: true };
    totDet.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.ambar } };
    totDet.getCell(4).numFmt = NUMBER;
    totDet.getCell(6).numFmt = CURRENCY;
    totDet.getCell(7).numFmt = CURRENCY;
    totDet.getCell(8).numFmt = CURRENCY;
    totDet.getCell(9).numFmt = CURRENCY;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DeduccionOperativa_${periodo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
