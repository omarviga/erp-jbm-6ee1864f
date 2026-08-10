import { COMPANY_INFO } from "@/lib/company";

export interface FacturaPrintItem {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  descuento?: number;
  importe: number;
}

export interface FacturaPrintData {
  folio: string;
  estado: string;
  fechaEmision: string;
  fechaVencimiento: string;
  cliente: {
    nombre: string;
    rfc?: string;
    direccion?: string;
    email?: string;
    telefono?: string;
    moneda?: string;
  };
  pago: {
    usoCfdi: string;
    formaPago: string;
    metodoPago: string;
  };
  items: FacturaPrintItem[];
  resumen: {
    subtotal: number;
    descuentos: number;
    iva: number;
    ieps: number;
    total: number;
  };
  notas?: string;
  terminos?: string;
}

const money = (value: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderFacturaHtml(data: FacturaPrintData) {
  const currency = data.cliente.moneda || "MXN";
  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.descripcion || "Sin descripcion")}</td>
        <td class="text-right">${item.cantidad}</td>
        <td>${escapeHtml(item.unidad || "PZA")}</td>
        <td class="text-right">${money(item.precio, currency)}</td>
        <td class="text-right">${item.descuento ? `${item.descuento}%` : "-"}</td>
        <td class="text-right">${money(item.importe, currency)}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <main class="page">
      <section class="header" style="align-items:flex-start;">
        <div style="display:flex; gap:16px; align-items:flex-start;">
          <img src="/logo-ticket.png" alt="JBM" style="width:72px; height:auto; object-fit:contain;" />
          <div>
            <h1 class="title">${escapeHtml(COMPANY_INFO.displayName)}</h1>
            <p class="subtitle muted">${escapeHtml(COMPANY_INFO.legalName)}</p>
            <p class="subtitle muted">${escapeHtml(COMPANY_INFO.addressLine1)}</p>
            <p class="subtitle muted">${escapeHtml(COMPANY_INFO.addressLine2)}</p>
            <p class="subtitle muted">Tel: ${escapeHtml(COMPANY_INFO.phone)}</p>
          </div>
        </div>
        <div style="text-align:right;">
          <p class="kpi-label" style="margin-top:0;">Factura</p>
          <p class="kpi-value" style="font-size:28px;">${escapeHtml(data.folio)}</p>
          <p class="subtitle muted">Estado: ${escapeHtml(data.estado)}</p>
          <p class="subtitle muted">Emision: ${escapeHtml(data.fechaEmision)}</p>
          <p class="subtitle muted">Vencimiento: ${escapeHtml(data.fechaVencimiento)}</p>
        </div>
      </section>

      <section class="grid grid-2" style="margin-bottom:16px;">
        <article class="card">
          <p class="kpi-label">Cliente</p>
          <p class="kpi-value" style="font-size:20px;">${escapeHtml(data.cliente.nombre)}</p>
          <p class="subtitle muted">RFC: ${escapeHtml(data.cliente.rfc || "Por definir")}</p>
          <p class="subtitle muted">Direccion: ${escapeHtml(data.cliente.direccion || "Sin registrar")}</p>
          <p class="subtitle muted">Correo: ${escapeHtml(data.cliente.email || "Sin registrar")}</p>
          <p class="subtitle muted">Telefono: ${escapeHtml(data.cliente.telefono || "Sin registrar")}</p>
        </article>
        <article class="card soft">
          <p class="kpi-label">Datos fiscales</p>
          <p class="subtitle muted">Uso CFDI: ${escapeHtml(data.pago.usoCfdi)}</p>
          <p class="subtitle muted">Forma de pago: ${escapeHtml(data.pago.formaPago)}</p>
          <p class="subtitle muted">Metodo de pago: ${escapeHtml(data.pago.metodoPago)}</p>
          <p class="subtitle muted">Moneda: ${escapeHtml(currency)}</p>
        </article>
      </section>

      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th class="text-right">Cant.</th>
            <th>Unidad</th>
            <th class="text-right">Precio</th>
            <th class="text-right">Desc.</th>
            <th class="text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" class="muted">Sin conceptos capturados.</td></tr>'}
        </tbody>
      </table>

      <section class="grid grid-2" style="margin-top:16px; align-items:start;">
        <div class="grid" style="gap:16px;">
          <article class="card soft">
            <p class="kpi-label">Notas</p>
            <p class="subtitle" style="margin:0; white-space:pre-wrap;">${escapeHtml(data.notas?.trim() || "Sin notas adicionales.")}</p>
          </article>
          <article class="card soft">
            <p class="kpi-label">Condiciones</p>
            <p class="subtitle" style="margin:0; white-space:pre-wrap;">${escapeHtml(data.terminos?.trim() || "Sin condiciones adicionales.")}</p>
          </article>
        </div>
        <article class="card" style="margin-left:auto; width:100%; max-width:360px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="muted">Subtotal</span>
            <strong>${money(data.resumen.subtotal, currency)}</strong>
          </div>
          ${
            data.resumen.descuentos > 0
              ? `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span class="muted">Descuentos</span><strong style="color:#dc2626;">-${money(data.resumen.descuentos, currency)}</strong></div>`
              : ""
          }
          ${
            data.resumen.iva > 0
              ? `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span class="muted">IVA</span><strong>${money(data.resumen.iva, currency)}</strong></div>`
              : ""
          }
          ${
            data.resumen.ieps > 0
              ? `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span class="muted">IEPS</span><strong>${money(data.resumen.ieps, currency)}</strong></div>`
              : ""
          }
          <div style="border-top:1px solid #e5e7eb; margin-top:12px; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:16px; font-weight:700;">Total</span>
            <strong style="font-size:24px; color:#111827;">${money(data.resumen.total, currency)}</strong>
          </div>
        </article>
      </section>

      <section class="footer">
        Documento generado desde JBM. Usa "Guardar como PDF" en el dialogo de impresion para conservar una copia.
      </section>
    </main>
  `;
}
