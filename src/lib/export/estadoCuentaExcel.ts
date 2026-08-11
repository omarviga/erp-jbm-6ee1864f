import ExcelJS from "exceljs";
import { COMPANY_INFO } from "@/lib/company";
import logoJbmUrl from "@/assets/logo-jbm.png";

export interface EstadoCuentaExcelNota {
  fecha: Date | string;
  folio: string;
  kilos: number;
  precio: number;
  importe: number;
  pagado: number;
  saldo: number;
}

export interface EstadoCuentaExcelPago {
  fecha: Date | string;
  metodo: string;
  referencia: string;
  monto: number;
}

export interface EstadoCuentaExcelProductor {
  productorId: string;
  nombre: string;
  rfc?: string | null;
  periodo: { inicio: string; fin: string };
  notas: EstadoCuentaExcelNota[];
  pagos: EstadoCuentaExcelPago[];
  resumen: { valorFruta: number; totalPagado: number; saldoPendiente: number };
}

const COLOR = {
  verde: "16A34A",
  verdeOscuro: "15803D",
  slate: "1F2937",
  grisTexto: "6B7280",
  grisFondo: "F8FAFC",
  azul: "1D4ED8",
  rojo: "DC2626",
  borde: "E5E7EB",
  blanco: "FFFFFF",
} as const;

const CURRENCY = '"$"#,##0.00';
const NUMBER = "#,##0.00";

const sheetName = (nombre: string) => {
  const limpio = nombre.replace(/[\\/?*[\]:]/g, "").trim();
  return (limpio || "Productor").slice(0, 28);
};

let logoCache: { buffer: ArrayBuffer; width: number; height: number } | null = null;

async function cargarLogo() {
  if (logoCache) return logoCache;

  const img = new Image();
  img.src = logoJbmUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo cargar el logo"));
  });

  const res = await fetch(logoJbmUrl);
  const buffer = await res.arrayBuffer();

  logoCache = { buffer, width: img.naturalWidth, height: img.naturalHeight };
  return logoCache;
}

function estiloTabla(worksheet: ExcelJS.Worksheet, primeraFila: number, ultimaFila: number, primeraCol: number, ultimaCol: number) {
  for (let r = primeraFila; r <= ultimaFila; r++) {
    for (let c = primeraCol; c <= ultimaCol; c++) {
      const celda = worksheet.getCell(r, c);
      celda.border = {
        top: { style: "thin", color: { argb: COLOR.borde } },
        left: { style: "thin", color: { argb: COLOR.borde } },
        bottom: { style: "thin", color: { argb: COLOR.borde } },
        right: { style: "thin", color: { argb: COLOR.borde } },
      };
    }
  }
}

async function pintarEncabezado(worksheet: ExcelJS.Worksheet, titulo: string, subtitulo: string, anchoTotal: number) {
  const logo = await cargarLogo();
  const altoLogo = 72;
  const anchoLogo = Math.round((altoLogo * logo.width) / logo.height);
  const imgId = worksheet.workbook.addImage({
    buffer: logo.buffer as unknown as Buffer,
    extension: "png",
  });
  worksheet.addImage(imgId, {
    tl: { col: 0, row: 0 },
    ext: { width: anchoLogo, height: altoLogo },
  });

  worksheet.mergeCells(1, 2, 1, anchoTotal);
  const tituloCell = worksheet.getCell(1, 2);
  tituloCell.value = COMPANY_INFO.displayName;
  tituloCell.font = { bold: true, size: 20, color: { argb: COLOR.slate } };

  worksheet.mergeCells(2, 2, 2, anchoTotal);
  const legalCell = worksheet.getCell(2, 2);
  legalCell.value = COMPANY_INFO.legalName;
  legalCell.font = { size: 10, color: { argb: COLOR.grisTexto } };

  worksheet.mergeCells(3, 2, 3, anchoTotal);
  const dirCell = worksheet.getCell(3, 2);
  dirCell.value = `${COMPANY_INFO.addressLine1}. ${COMPANY_INFO.addressLine2}`;
  dirCell.font = { size: 9, color: { argb: COLOR.grisTexto } };

  worksheet.mergeCells(4, 2, 4, anchoTotal);
  const telCell = worksheet.getCell(4, 2);
  telCell.value = `Tel: ${COMPANY_INFO.phone}`;
  telCell.font = { size: 9, color: { argb: COLOR.grisTexto } };

  worksheet.mergeCells(1, anchoTotal + 2, 4, anchoTotal + 2);

  const docCell = worksheet.getCell(1, anchoTotal + 2);
  docCell.value = titulo;
  docCell.font = { bold: true, size: 15, color: { argb: COLOR.verdeOscuro } };
  docCell.alignment = { horizontal: "right", vertical: "middle" };

  worksheet.getCell(2, anchoTotal + 2).value = subtitulo;
  worksheet.getCell(2, anchoTotal + 2).font = { size: 10, color: { argb: COLOR.grisTexto } };
  worksheet.getCell(2, anchoTotal + 2).alignment = { horizontal: "right" };

  worksheet.getCell(3, anchoTotal + 2).value = `Generado: ${new Date().toLocaleDateString("es-MX")}`;
  worksheet.getCell(3, anchoTotal + 2).font = { size: 9, color: { argb: COLOR.grisTexto } };
  worksheet.getCell(3, anchoTotal + 2).alignment = { horizontal: "right" };

  worksheet.getCell(4, anchoTotal + 2).value = "";
}

function hojaProductor(workbook: ExcelJS.Workbook, p: EstadoCuentaExcelProductor) {
  const ws = workbook.addWorksheet(`EC - ${sheetName(p.nombre)}`, {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 4 },   // A logo/espaciado
    { width: 16 },  // B fecha
    { width: 14 },  // C folio
    { width: 12 },  // D kilos
    { width: 12 },  // E precio
    { width: 15 },  // F importe
    { width: 15 },  // G pagado
    { width: 15 },  // H saldo
    { width: 4 },   // I espaciado
  ];

  void pintarEncabezado(ws, "Estado de Cuenta", "Cuentas por Pagar a Productor", 8);

  // Fila 6: separador
  ws.getCell(6, 1).value = "";

  // Fila 7: bloque de productor
  ws.mergeCells(7, 1, 7, 8);
  const prodCell = ws.getCell(7, 1);
  prodCell.value = `Productor: ${p.nombre}`;
  prodCell.font = { bold: true, size: 12, color: { argb: COLOR.slate } };
  prodCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.grisFondo } };
  prodCell.alignment = { vertical: "middle" };
  ws.getRow(7).height = 22;

  ws.mergeCells(8, 1, 8, 8);
  const rfcCell = ws.getCell(8, 1);
  rfcCell.value = `RFC: ${p.rfc || "XAXX010101000"}   ·   Periodo: ${p.periodo.inicio} al ${p.periodo.fin}`;
  rfcCell.font = { size: 9, color: { argb: COLOR.grisTexto } };
  rfcCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.grisFondo } };

  // Fila 10: KPIs
  const kpis: Array<{ label: string; value: number; color: string }> = [
    { label: "Valor de Fruta", value: p.resumen.valorFruta, color: COLOR.azul },
    { label: "Pagos Registrados", value: p.resumen.totalPagado, color: COLOR.verdeOscuro },
    { label: "Saldo Pendiente", value: p.resumen.saldoPendiente, color: COLOR.rojo },
  ];

  kpis.forEach((kpi, idx) => {
    const colIni = idx * 3 + 1;
    ws.mergeCells(10, colIni, 10, colIni + 2);
    const cell = ws.getCell(10, colIni);
    cell.value = `${kpi.label}: `;
    cell.font = { size: 9, color: { argb: COLOR.grisTexto } };
    const rv = ws.getCell(10, colIni + 2);
    rv.value = kpi.value;
    rv.numFmt = CURRENCY;
    rv.font = { bold: true, size: 11, color: { argb: kpi.color } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.grisFondo } };
    ws.mergeCells(10, colIni, 10, colIni + 2);
    ws.getCell(10, colIni).border = { top: { style: "thin", color: { argb: COLOR.borde } }, bottom: { style: "thin", color: { argb: COLOR.borde } } };
  });
  ws.getRow(10).height = 24;

  // Fila 12: título Notas
  ws.mergeCells(12, 1, 12, 8);
  const tNotas = ws.getCell(12, 1);
  tNotas.value = "Notas / Tickets";
  tNotas.font = { bold: true, size: 11, color: { argb: COLOR.slate } };

  // Fila 13: encabezado tabla notas
  const headerNotas = ["", "Fecha", "No. Nota", "Kilos", "Precio", "Importe", "Pagado", "Saldo"];
  headerNotas.forEach((h, idx) => {
    const cell = ws.getCell(13, idx + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: COLOR.blanco } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.verde } };
    cell.alignment = { horizontal: idx === 0 ? "left" : "right" };
  });
  ws.getRow(13).height = 20;

  let fila = 14;
  if (p.notas.length === 0) {
    ws.mergeCells(fila, 1, fila, 8);
    ws.getCell(fila, 1).value = "Sin notas.";
    ws.getCell(fila, 1).font = { size: 9, color: { argb: COLOR.grisTexto } };
    fila += 1;
  } else {
    p.notas.forEach((n, idx) => {
      ws.getCell(fila, 1).value = "";
      ws.getCell(fila, 2).value = n.fecha;
      ws.getCell(fila, 2).numFmt = "dd/mm/yyyy";
      ws.getCell(fila, 2).alignment = { horizontal: "right" };
      ws.getCell(fila, 3).value = n.folio;
      ws.getCell(fila, 3).alignment = { horizontal: "right" };
      ws.getCell(fila, 4).value = n.kilos;
      ws.getCell(fila, 4).numFmt = NUMBER;
      ws.getCell(fila, 4).alignment = { horizontal: "right" };
      ws.getCell(fila, 5).value = n.precio;
      ws.getCell(fila, 5).numFmt = CURRENCY;
      ws.getCell(fila, 5).alignment = { horizontal: "right" };
      ws.getCell(fila, 6).value = n.importe;
      ws.getCell(fila, 6).numFmt = CURRENCY;
      ws.getCell(fila, 6).alignment = { horizontal: "right" };
      ws.getCell(fila, 7).value = n.pagado;
      ws.getCell(fila, 7).numFmt = CURRENCY;
      ws.getCell(fila, 7).alignment = { horizontal: "right" };
      ws.getCell(fila, 7).font = { color: { argb: COLOR.verdeOscuro } };
      ws.getCell(fila, 8).value = n.saldo;
      ws.getCell(fila, 8).numFmt = CURRENCY;
      ws.getCell(fila, 8).alignment = { horizontal: "right" };
      ws.getCell(fila, 8).font = { bold: true, color: { argb: COLOR.rojo } };

      if (idx % 2 === 1) {
        for (let c = 1; c <= 8; c++) {
          ws.getCell(fila, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F9FAFB" } };
        }
      }
      fila += 1;
    });
  }

  // Fila totales
  const filaTotales = fila;
  ws.mergeCells(filaTotales, 1, filaTotales, 5);
  ws.getCell(filaTotales, 1).value = "TOTALES";
  ws.getCell(filaTotales, 1).font = { bold: true, size: 9, color: { argb: COLOR.slate } };
  ws.getCell(filaTotales, 6).value = p.resumen.valorFruta;
  ws.getCell(filaTotales, 6).numFmt = CURRENCY;
  ws.getCell(filaTotales, 6).font = { bold: true, size: 9 };
  ws.getCell(filaTotales, 7).value = p.resumen.totalPagado;
  ws.getCell(filaTotales, 7).numFmt = CURRENCY;
  ws.getCell(filaTotales, 7).font = { bold: true, size: 9, color: { argb: COLOR.verdeOscuro } };
  ws.getCell(filaTotales, 8).value = p.resumen.saldoPendiente;
  ws.getCell(filaTotales, 8).numFmt = CURRENCY;
  ws.getCell(filaTotales, 8).font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
  for (let c = 1; c <= 8; c++) {
    ws.getCell(filaTotales, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.grisFondo } };
  }
  estiloTabla(ws, 13, filaTotales, 1, 8);

  fila = filaTotales + 2;

  // Sección pagos
  ws.mergeCells(fila, 1, fila, 8);
  const tPagos = ws.getCell(fila, 1);
  tPagos.value = "Pagos Registrados";
  tPagos.font = { bold: true, size: 11, color: { argb: COLOR.slate } };
  fila += 1;

  const headerPagos = ["", "Fecha", "Método", "Referencia", "Monto", "", "", ""];
  headerPagos.forEach((h, idx) => {
    const cell = ws.getCell(fila, idx + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: COLOR.blanco } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.verde } };
    cell.alignment = { horizontal: idx <= 1 ? "left" : "right" };
  });
  ws.getRow(fila).height = 20;
  const filaHeaderPagos = fila;
  fila += 1;

  if (p.pagos.length === 0) {
    ws.mergeCells(fila, 1, fila, 8);
    ws.getCell(fila, 1).value = "Sin pagos registrados.";
    ws.getCell(fila, 1).font = { size: 9, color: { argb: COLOR.grisTexto } };
  } else {
    p.pagos.forEach((pg, idx) => {
      ws.getCell(fila, 1).value = "";
      ws.getCell(fila, 2).value = pg.fecha;
      ws.getCell(fila, 2).numFmt = "dd/mm/yyyy";
      ws.getCell(fila, 2).alignment = { horizontal: "right" };
      ws.getCell(fila, 3).value = pg.metodo;
      ws.getCell(fila, 3).alignment = { horizontal: "left" };
      ws.getCell(fila, 4).value = pg.referencia;
      ws.getCell(fila, 4).alignment = { horizontal: "left" };
      ws.getCell(fila, 5).value = pg.monto;
      ws.getCell(fila, 5).numFmt = CURRENCY;
      ws.getCell(fila, 5).alignment = { horizontal: "right" };
      ws.getCell(fila, 5).font = { color: { argb: COLOR.verdeOscuro } };
      if (idx % 2 === 1) {
        for (let c = 1; c <= 8; c++) {
          ws.getCell(fila, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F9FAFB" } };
        }
      }
      fila += 1;
    });
  }
  estiloTabla(ws, filaHeaderPagos, fila - 1, 1, 5);

  ws.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
  ws.pageSetup.printArea = `A1:I${fila}`;
}

function hojaResumen(workbook: ExcelJS.Workbook, productores: EstadoCuentaExcelProductor[]) {
  const ws = workbook.addWorksheet("Resumen General", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 4 },
    { width: 34 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 4 },
  ];

  void pintarEncabezado(ws, "Resumen General", "Cuentas por Pagar a Productores", 6);

  ws.getRow(6).height = 12;

  const headers = ["", "Productor", "Valor de Fruta", "Pagos Registrados", "Saldo Pendiente", "Notas"];
  headers.forEach((h, idx) => {
    const cell = ws.getCell(7, idx + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: COLOR.blanco } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.verde } };
    cell.alignment = { horizontal: idx === 1 ? "left" : "right" };
  });
  ws.getRow(7).height = 20;

  let fila = 8;
  const totales = { valorFruta: 0, pagado: 0, saldo: 0, notas: 0 };

  productores.forEach((p, idx) => {
    ws.getCell(fila, 1).value = "";
    ws.getCell(fila, 2).value = p.nombre;
    ws.getCell(fila, 2).alignment = { horizontal: "left" };
    ws.getCell(fila, 2).font = { bold: true, size: 9, color: { argb: COLOR.slate } };
    ws.getCell(fila, 3).value = p.resumen.valorFruta;
    ws.getCell(fila, 3).numFmt = CURRENCY;
    ws.getCell(fila, 3).alignment = { horizontal: "right" };
    ws.getCell(fila, 4).value = p.resumen.totalPagado;
    ws.getCell(fila, 4).numFmt = CURRENCY;
    ws.getCell(fila, 4).alignment = { horizontal: "right" };
    ws.getCell(fila, 5).value = p.resumen.saldoPendiente;
    ws.getCell(fila, 5).numFmt = CURRENCY;
    ws.getCell(fila, 5).alignment = { horizontal: "right" };
    ws.getCell(fila, 5).font = { bold: true, color: { argb: COLOR.rojo } };
    ws.getCell(fila, 6).value = p.notas.length;
    ws.getCell(fila, 6).alignment = { horizontal: "right" };

    if (idx % 2 === 1) {
      for (let c = 1; c <= 6; c++) {
        ws.getCell(fila, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F9FAFB" } };
      }
    }

    totales.valorFruta += p.resumen.valorFruta;
    totales.pagado += p.resumen.totalPagado;
    totales.saldo += p.resumen.saldoPendiente;
    totales.notas += p.notas.length;
    fila += 1;
  });

  ws.mergeCells(fila, 1, fila, 2);
  ws.getCell(fila, 1).value = "TOTALES";
  ws.getCell(fila, 1).font = { bold: true, size: 9, color: { argb: COLOR.slate } };
  ws.getCell(fila, 3).value = totales.valorFruta;
  ws.getCell(fila, 3).numFmt = CURRENCY;
  ws.getCell(fila, 3).font = { bold: true, size: 9 };
  ws.getCell(fila, 4).value = totales.pagado;
  ws.getCell(fila, 4).numFmt = CURRENCY;
  ws.getCell(fila, 4).font = { bold: true, size: 9, color: { argb: COLOR.verdeOscuro } };
  ws.getCell(fila, 5).value = totales.saldo;
  ws.getCell(fila, 5).numFmt = CURRENCY;
  ws.getCell(fila, 5).font = { bold: true, size: 9, color: { argb: COLOR.rojo } };
  ws.getCell(fila, 6).value = totales.notas;
  ws.getCell(fila, 6).font = { bold: true, size: 9 };
  for (let c = 1; c <= 6; c++) {
    ws.getCell(fila, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.grisFondo } };
  }
  estiloTabla(ws, 7, fila, 1, 6);

  ws.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
  ws.pageSetup.printArea = `A1:F${fila}`;
}

export async function descargarEstadoCuentaExcel(productores: EstadoCuentaExcelProductor[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JBM ERP";
  workbook.created = new Date();

  if (productores.length === 0) return;

  hojaResumen(workbook, productores);
  productores.forEach((p) => hojaProductor(workbook, p));

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `EstadoCuenta_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
