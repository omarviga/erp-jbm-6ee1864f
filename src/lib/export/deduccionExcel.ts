import ExcelJS from "exceljs";
import { COMPANY_INFO } from "@/lib/company";

export interface DeduccionExcelFila {
  productor: string;
  boletas: number;
  kilos: number;
  fija: number;
  provision: number;
  total: number;
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
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JBM ERP";
  workbook.created = new Date();

  if (filas.length === 0) return;

  const hoja = workbook.addWorksheet("Deducción operativa");
  hoja.columns = [
    { width: 38 },
    { width: 12 },
    { width: 16 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
  ];

  hoja.mergeCells("A1:F1");
  const titulo = hoja.getCell("A1");
  titulo.value = `${COMPANY_INFO.displayName} — Consolidado de Deducción Operativa`;
  titulo.font = { size: 14, bold: true, color: { argb: COLOR.slate } };

  hoja.mergeCells("A2:F2");
  const subt = hoja.getCell("A2");
  subt.value = `Periodo: ${periodo}`;
  subt.font = { size: 11, color: { argb: COLOR.grisTexto } };

  const head = hoja.getRow(4);
  head.values = ["Productor", "Boletas", "Kilos netos", "Ded. fija ($30/bol)", "Provisión ($0.04/kg)", "Total"];
  head.font = { bold: true, color: { argb: COLOR.blanco } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.slate } };

  let r = 5;
  for (const f of filas) {
    const row = hoja.getRow(r);
    row.values = [f.productor, f.boletas, f.kilos, f.fija, f.provision, f.total];
    row.getCell(2).numFmt = ENTERO;
    row.getCell(3).numFmt = NUMBER;
    row.getCell(4).numFmt = CURRENCY;
    row.getCell(5).numFmt = CURRENCY;
    row.getCell(6).numFmt = CURRENCY;
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
    "",
    "",
    filas.reduce((s, f) => s + f.total, 0),
  ];
  tot.font = { bold: true };
  tot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.ambar } };
  tot.getCell(2).numFmt = ENTERO;
  tot.getCell(3).numFmt = NUMBER;
  tot.getCell(6).numFmt = CURRENCY;

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
