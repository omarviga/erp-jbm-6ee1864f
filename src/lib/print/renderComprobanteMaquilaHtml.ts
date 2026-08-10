import { format } from "date-fns";
import { es } from "date-fns/locale";

type ComprobanteMaquilaData = {
  folio: string;
  fecha: string;
  cliente: {
    nombre: string;
    rfc?: string | null;
    contacto?: string | null;
    telefono?: string | null;
  };
  orden: {
    status?: string | null;
    kilosRecibidos: number;
    kilosProcesados: number;
    cajasEmpacadas: number;
  };
  tarifas: {
    tarifaKg: number;
    tarifaCaja: number;
  };
  costos: {
    costoKg: number;
    costoCaja: number;
    costoTotal: number;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const number = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderComprobanteMaquilaHtml(data: ComprobanteMaquilaData) {
  const fecha = data.fecha
    ? format(new Date(data.fecha), "dd MMM yyyy", { locale: es })
    : format(new Date(), "dd MMM yyyy", { locale: es });

  return `
    <main class="page">
      <section class="header" style="align-items:flex-start;">
        <div>
          <h1 class="title">Comprobante de Maquila</h1>
          <p class="subtitle muted">Folio: ${escapeHtml(data.folio)}</p>
          <p class="subtitle muted">Fecha: ${escapeHtml(fecha)}</p>
        </div>
        <div style="text-align:right;">
          <p class="kpi-label" style="margin-top:0;">Estatus</p>
          <p class="kpi-value" style="font-size:20px;">${escapeHtml(data.orden.status || "en_proceso")}</p>
        </div>
      </section>

      <section class="grid grid-2" style="margin-bottom:16px;">
        <article class="card">
          <p class="kpi-label">Cliente</p>
          <p class="kpi-value" style="font-size:18px;">${escapeHtml(data.cliente.nombre)}</p>
          <p class="subtitle muted">RFC: ${escapeHtml(data.cliente.rfc || "Sin registrar")}</p>
          <p class="subtitle muted">Contacto: ${escapeHtml(data.cliente.contacto || "Sin registrar")}</p>
          <p class="subtitle muted">Telefono: ${escapeHtml(data.cliente.telefono || "Sin registrar")}</p>
        </article>
        <article class="card soft">
          <p class="kpi-label">Tarifas</p>
          <p class="subtitle muted">Tarifa por kg: <strong>${money(data.tarifas.tarifaKg)}</strong></p>
          <p class="subtitle muted">Tarifa por caja: <strong>${money(data.tarifas.tarifaCaja)}</strong></p>
        </article>
      </section>

      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th class="text-right">Cantidad</th>
            <th class="text-right">Tarifa</th>
            <th class="text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Kilos procesados</td>
            <td class="text-right">${number(data.orden.kilosProcesados)} kg</td>
            <td class="text-right">${money(data.tarifas.tarifaKg)}</td>
            <td class="text-right">${money(data.costos.costoKg)}</td>
          </tr>
          <tr>
            <td>Cajas empacadas</td>
            <td class="text-right">${number(data.orden.cajasEmpacadas)} cajas</td>
            <td class="text-right">${money(data.tarifas.tarifaCaja)}</td>
            <td class="text-right">${money(data.costos.costoCaja)}</td>
          </tr>
        </tbody>
      </table>

      <section class="grid grid-2" style="margin-top:16px; align-items:start;">
        <article class="card soft">
          <p class="kpi-label">Resumen de orden</p>
          <p class="subtitle muted">Kg recibidos: ${number(data.orden.kilosRecibidos)} kg</p>
          <p class="subtitle muted">Kg procesados: ${number(data.orden.kilosProcesados)} kg</p>
          <p class="subtitle muted">Cajas empacadas: ${number(data.orden.cajasEmpacadas)} cajas</p>
        </article>
        <article class="card" style="margin-left:auto; width:100%; max-width:360px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="muted">Subtotal servicio</span>
            <strong>${money(data.costos.costoKg + data.costos.costoCaja)}</strong>
          </div>
          <div style="border-top:1px solid #e5e7eb; margin-top:12px; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:16px; font-weight:700;">Total</span>
            <strong style="font-size:24px; color:#111827;">${money(data.costos.costoTotal)}</strong>
          </div>
        </article>
      </section>

      <section class="footer">
        Documento generado desde JBM. Usa "Guardar como PDF" en el dialogo de impresion para descargarlo.
      </section>
    </main>
  `;
}
