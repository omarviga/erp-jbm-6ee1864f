import { COMPANY_INFO } from "@/lib/company";

export interface EstadoCuentaMovimiento {
  fecha: string;
  folio: string;
  concepto: string;
  cargos: number;
  abonos: number;
  saldo: number;
}

export interface EstadoCuentaPrintData {
  productor: {
    id: string;
    nombre: string;
    rfc?: string | null;
  };
  periodo: {
    inicio: string;
    fin: string;
  };
  resumen: {
    saldoInicial: number;
    totalAbonos: number;
    totalCargos: number;
    saldoFinal: number;
  };
  movimientos: EstadoCuentaMovimiento[];
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

export function renderEstadoCuentaHtml({ productor, periodo, resumen, movimientos }: EstadoCuentaPrintData) {
  const movimientosRows = movimientos.map((movimiento) => `
      <tr>
        <td>${escapeHtml(movimiento.fecha)}</td>
        <td>${escapeHtml(movimiento.folio)}</td>
        <td>${escapeHtml(movimiento.concepto)}</td>
        <td class="text-right">$${money(movimiento.cargos)}</td>
        <td class="text-right">$${money(movimiento.abonos)}</td>
      </tr>
    `).join("");

  return `
    <main class="page">
      <section class="header">
        <div>
          <h1 class="title">${escapeHtml(COMPANY_INFO.displayName)}</h1>
          <p class="subtitle muted">${escapeHtml(COMPANY_INFO.addressLine1)}</p>
          <p class="subtitle muted">${escapeHtml(COMPANY_INFO.addressLine2)}</p>
          <p class="subtitle muted">Tel: ${escapeHtml(COMPANY_INFO.phone)}</p>
        </div>
        <div>
          <h2 class="title">Estado de Cuenta</h2>
          <p class="subtitle muted">Periodo: ${escapeHtml(periodo.inicio)} al ${escapeHtml(periodo.fin)}</p>
          <p class="subtitle muted">Generado: ${new Date().toLocaleDateString("es-MX")}</p>
        </div>
      </section>

      <section class="card soft">
        <p class="kpi-label">Productor</p>
        <p class="kpi-value">${escapeHtml(productor.nombre)}</p>
        <p class="subtitle muted">ID: ${escapeHtml(productor.id)} | RFC: ${escapeHtml(productor.rfc || "XAXX010101000")}</p>
      </section>

      <section class="grid grid-4" style="margin-top: 16px;">
        <article class="card">
          <p class="kpi-label">Saldo Inicial</p>
          <p class="kpi-value">$${money(resumen.saldoInicial)}</p>
        </article>
        <article class="card">
          <p class="kpi-label">Valor Fruta</p>
          <p class="kpi-value" style="color:#16a34a;">$${money(resumen.totalAbonos)}</p>
        </article>
        <article class="card">
          <p class="kpi-label">Anticipos / Ded.</p>
          <p class="kpi-value" style="color:#dc2626;">$${money(resumen.totalCargos)}</p>
        </article>
        <article class="card" style="background:#f0fdf4;border-color:#86efac;">
          <p class="kpi-label">A Pagar</p>
          <p class="kpi-value" style="color:#15803d;">$${money(resumen.saldoFinal)}</p>
        </article>
      </section>

      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Folio</th>
            <th>Concepto</th>
            <th class="text-right">Cargos</th>
            <th class="text-right">Abonos</th>
          </tr>
        </thead>
        <tbody>
          ${movimientosRows || '<tr><td colspan="5" class="muted">Sin movimientos.</td></tr>'}
        </tbody>
      </table>

      <section class="footer">
        Documento generado desde JBM. Usa "Guardar como PDF" en el dialogo de impresion si necesitas archivo.
      </section>
    </main>
  `;
}
