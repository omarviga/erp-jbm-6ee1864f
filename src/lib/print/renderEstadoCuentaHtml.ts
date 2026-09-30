import { COMPANY_INFO } from "@/lib/company";

export interface EstadoCuentaNota {
  fecha: string;
  folio: string;
  kilos: number;
  precio: number;
  importe: number;
  pagado: number;
  saldo: number;
}

export interface EstadoCuentaPago {
  fecha: string;
  metodo: string;
  referencia: string;
  monto: number;
}

export interface EstadoCuentaPrintData {
  productor: {
    nombre: string;
    rfc?: string | null;
  };
  periodo: {
    inicio: string;
    fin: string;
  };
  notas: EstadoCuentaNota[];
  pagos: EstadoCuentaPago[];
  resumen: {
    valorFruta: number;
    totalPagado: number;
    saldoPendiente: number;
  };
}

const money = (value: number) =>
  value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderEstadoCuentaHtml({ productor, periodo, notas, pagos, resumen }: EstadoCuentaPrintData) {
  const notasRows = notas.map((nota) => `
      <tr>
        <td>${escapeHtml(nota.fecha)}</td>
        <td class="text-right">${escapeHtml(nota.folio)}</td>
        <td class="text-right">${nota.kilos.toLocaleString("es-MX")} kg</td>
        <td class="text-right">$${money(nota.precio)}</td>
        <td class="text-right">$${money(nota.importe)}</td>
        <td class="text-right" style="color:#16a34a;">$${money(nota.pagado)}</td>
        <td class="text-right" style="color:#dc2626;font-weight:700;">$${money(nota.saldo)}</td>
      </tr>
    `).join("");

  const pagosRows = pagos.map((pago) => `
      <tr>
        <td>${escapeHtml(pago.fecha)}</td>
        <td style="text-transform:capitalize;">${escapeHtml(pago.metodo)}</td>
        <td>${escapeHtml(pago.referencia)}</td>
        <td class="text-right" style="color:#16a34a;">$${money(pago.monto)}</td>
      </tr>
    `).join("");

  return `
    <main class="page">
      <section class="header">
        <div>
          <h1 class="title">${escapeHtml(COMPANY_INFO.displayName)}</h1>
          <p class="subtitle muted">${escapeHtml(COMPANY_INFO.legalName)}</p>
          <p class="subtitle muted">${escapeHtml(COMPANY_INFO.addressLine1)}</p>
          <p class="subtitle muted">Tel: ${escapeHtml(COMPANY_INFO.phone)}</p>
        </div>
        <div style="text-align:right;">
          <h2 class="title">Estado de Cuenta</h2>
          <p class="subtitle muted">Cuentas por Pagar a Productor</p>
          <p class="subtitle muted">Periodo: ${escapeHtml(periodo.inicio)} al ${escapeHtml(periodo.fin)}</p>
          <p class="subtitle muted">Generado: ${new Date().toLocaleDateString("es-MX")}</p>
        </div>
      </section>

      <section class="card soft">
        <p class="kpi-label">Productor</p>
        <p class="kpi-value">${escapeHtml(productor.nombre)}</p>
        <p class="subtitle muted">RFC: ${escapeHtml(productor.rfc || "XAXX010101000")}</p>
      </section>

      <section style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px;">
        <article class="card">
          <p class="kpi-label">Valor de Fruta</p>
          <p class="kpi-value" style="color:#1d4ed8;">$${money(resumen.valorFruta)}</p>
        </article>
        <article class="card">
          <p class="kpi-label">Pagos Registrados</p>
          <p class="kpi-value" style="color:#16a34a;">$${money(resumen.totalPagado)}</p>
        </article>
        <article class="card" style="background:#f0fdf4;border-color:#86efac;">
          <p class="kpi-label">Saldo Pendiente</p>
          <p class="kpi-value" style="color:#dc2626;">$${money(resumen.saldoPendiente)}</p>
        </article>
      </section>

      <h3 style="margin:24px 0 8px;font-size:16px;color:#1f2937;">Notas / Tickets</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th class="text-right">No. Nota</th>
            <th class="text-right">Kilos</th>
            <th class="text-right">Precio</th>
            <th class="text-right">Importe</th>
            <th class="text-right">Pagado</th>
            <th class="text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${notasRows || '<tr><td colspan="7" class="muted">Sin notas.</td></tr>'}
        </tbody>
        <tfoot>
          <tr style="background:#f8fafc;font-weight:700;">
            <td colspan="4">TOTALES</td>
            <td class="text-right">$${money(resumen.valorFruta)}</td>
            <td class="text-right" style="color:#16a34a;">$${money(resumen.totalPagado)}</td>
            <td class="text-right" style="color:#dc2626;">$${money(resumen.saldoPendiente)}</td>
          </tr>
        </tfoot>
      </table>

      <h3 style="margin:24px 0 8px;font-size:16px;color:#1f2937;">Pagos Registrados</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Método</th>
            <th>Referencia</th>
            <th class="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${pagosRows || '<tr><td colspan="4" class="muted">Sin pagos registrados.</td></tr>'}
        </tbody>
      </table>

      <section class="footer">
        Documento generado desde JBM. Usa "Guardar como PDF" en el diálogo de impresión si necesitas archivo.
      </section>
    </main>
  `;
}
