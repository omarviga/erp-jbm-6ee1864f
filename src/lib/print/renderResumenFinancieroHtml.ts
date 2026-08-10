import { COMPANY_ADDRESS, COMPANY_INFO } from "@/lib/company";

export interface ResumenFinancieroGasto {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  proveedor?: string | null;
  monto: number;
}

export interface ResumenFinancieroPrintData {
  periodo: string;
  totalIngresos: number;
  totalLiquidaciones: number;
  totalGastos: number;
  utilidadBruta: number;
  gastosPorCategoria: { name: string; value: number }[];
  gastosFiltrados: ResumenFinancieroGasto[];
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

export function renderResumenFinancieroHtml(data: ResumenFinancieroPrintData) {
  const totalEgresos = data.totalLiquidaciones + data.totalGastos;
  const gastosRows = data.gastosFiltrados.map((gasto) => `
      <tr>
        <td>${escapeHtml(gasto.fecha)}</td>
        <td>${escapeHtml(gasto.concepto)}</td>
        <td>${escapeHtml(gasto.categoria)}</td>
        <td>${escapeHtml(gasto.proveedor || "-")}</td>
        <td class="text-right">$${money(gasto.monto)}</td>
      </tr>
    `).join("");

  const categoriaRows = data.gastosPorCategoria.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="text-right">$${money(item.value)}</td>
      </tr>
    `).join("");

  return `
    <main class="page">
      <section class="header">
        <div>
          <h1 class="title">${escapeHtml(COMPANY_INFO.displayName)}</h1>
          <p class="subtitle muted">${escapeHtml(COMPANY_ADDRESS)}</p>
        </div>
        <div>
          <h2 class="title">Resumen Financiero</h2>
          <p class="subtitle muted">Periodo: ${escapeHtml(data.periodo)}</p>
          <p class="subtitle muted">Generado: ${new Date().toLocaleDateString("es-MX")}</p>
        </div>
      </section>

      <section class="grid grid-4">
        <article class="card" style="background:#f0fdf4;border-color:#86efac;">
          <p class="kpi-label">Ingresos</p>
          <p class="kpi-value" style="color:#16a34a;">$${money(data.totalIngresos)}</p>
        </article>
        <article class="card" style="background:#fff7ed;border-color:#fdba74;">
          <p class="kpi-label">Pago Productores</p>
          <p class="kpi-value" style="color:#ea580c;">$${money(data.totalLiquidaciones)}</p>
        </article>
        <article class="card" style="background:#fef2f2;border-color:#fca5a5;">
          <p class="kpi-label">Gastos</p>
          <p class="kpi-value" style="color:#dc2626;">$${money(data.totalGastos)}</p>
        </article>
        <article class="card">
          <p class="kpi-label">Utilidad Bruta</p>
          <p class="kpi-value">$${money(data.utilidadBruta)}</p>
        </article>
      </section>

      <section class="grid grid-2" style="margin-top: 16px;">
        <article class="card">
          <p class="kpi-label">Resumen</p>
          <table style="margin-top: 0;">
            <tbody>
              <tr><td>Ingresos</td><td class="text-right">$${money(data.totalIngresos)}</td></tr>
              <tr><td>Egresos</td><td class="text-right">$${money(totalEgresos)}</td></tr>
              <tr><td>Utilidad Bruta</td><td class="text-right">$${money(data.utilidadBruta)}</td></tr>
            </tbody>
          </table>
        </article>
        <article class="card">
          <p class="kpi-label">Gastos por Categoria</p>
          <table style="margin-top: 0;">
            <tbody>
              ${categoriaRows || '<tr><td colspan="2" class="muted">Sin categorias.</td></tr>'}
            </tbody>
          </table>
        </article>
      </section>

      <section style="margin-top: 24px;">
        <h3 class="title" style="font-size:18px;">Detalle de Gastos</h3>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Categoria</th>
              <th>Proveedor</th>
              <th class="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${gastosRows || '<tr><td colspan="5" class="muted">Sin gastos registrados.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="footer">
        Documento generado desde JBM. Usa "Guardar como PDF" en el dialogo de impresion si necesitas archivo.
      </section>
    </main>
  `;
}
