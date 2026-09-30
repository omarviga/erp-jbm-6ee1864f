import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

type CartaPortePrintData = {
  folio: string;
  fecha: string;
  cliente: string;
  estado: string;
  origen: string;
  destino: string;
  pesoTotalKg: number;
  urlValidacion: string;
  totalCajas?: number | null;
  valorMercancia?: number | null;
  tipoTransporte?: string | null;
  transportista?: string | null;
  temperaturaPrecarga?: number | null;
  uuid?: string | null;
  notas?: string | null;
  documentosAdjuntos?: string[] | null;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);

export function renderCartaPorteHtml(data: CartaPortePrintData) {
  const qrMarkup = renderToStaticMarkup(
    <QRCodeSVG
      value={data.urlValidacion}
      size={170}
      level="M"
      includeMargin={true}
      bgColor="#ffffff"
      fgColor="#0f172a"
    />
  );

  const documentosHtml =
    data.documentosAdjuntos && data.documentosAdjuntos.length > 0
      ? data.documentosAdjuntos.map((documento) => `<li>${documento}</li>`).join("")
      : "<li>Sin documentos adjuntos</li>";

  return `
    <div class="page">
      <div class="header">
        <div>
          <img src="/logo-ticket.png" alt="JBM" style="height:64px;width:auto;object-fit:contain;margin-bottom:12px;" />
          <h1 class="title">Carta Porte</h1>
          <p class="subtitle muted">Documento generado desde Logistica JBM</p>
        </div>
        <div class="card soft" style="min-width:240px;">
          <p class="kpi-label">Folio</p>
          <p class="kpi-value" style="font-size:28px;">${data.folio}</p>
          <p class="muted" style="margin:8px 0 0;">${data.fecha}</p>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <p class="kpi-label">Cliente</p>
          <p class="kpi-value" style="font-size:18px;">${data.cliente}</p>
        </div>
        <div class="card">
          <p class="kpi-label">Estado</p>
          <p class="kpi-value" style="font-size:18px;">${data.estado}</p>
        </div>
        <div class="card">
          <p class="kpi-label">Origen</p>
          <p class="kpi-value" style="font-size:18px;">${data.origen}</p>
        </div>
        <div class="card">
          <p class="kpi-label">Destino</p>
          <p class="kpi-value" style="font-size:18px;">${data.destino}</p>
        </div>
      </div>

      <div class="grid grid-4" style="margin-top:16px;">
        <div class="card">
          <p class="kpi-label">Peso Total</p>
          <p class="kpi-value">${data.pesoTotalKg.toLocaleString("es-MX")} kg</p>
        </div>
        <div class="card">
          <p class="kpi-label">Cajas</p>
          <p class="kpi-value">${(data.totalCajas ?? 0).toLocaleString("es-MX")}</p>
        </div>
        <div class="card">
          <p class="kpi-label">Valor Mercancia</p>
          <p class="kpi-value">${formatCurrency(data.valorMercancia ?? 0)}</p>
        </div>
        <div class="card">
          <p class="kpi-label">Temperatura</p>
          <p class="kpi-value">${data.temperaturaPrecarga != null ? `${data.temperaturaPrecarga} °C` : "N/D"}</p>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:16px;align-items:start;">
        <div class="card">
          <p class="kpi-label">Datos Operativos</p>
          <table style="margin-top:8px;">
            <tbody>
              <tr>
                <td style="width:40%;"><strong>Transporte</strong></td>
                <td>${data.tipoTransporte || "No especificado"}</td>
              </tr>
              <tr>
                <td><strong>Transportista</strong></td>
                <td>${data.transportista || "No especificado"}</td>
              </tr>
              <tr>
                <td><strong>UUID</strong></td>
                <td>${data.uuid || "No disponible"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card soft" style="text-align:center;">
          <p class="kpi-label">Validacion</p>
          <div style="display:flex;justify-content:center;margin-bottom:10px;">${qrMarkup}</div>
          <p class="muted" style="word-break:break-all;margin:0;">${data.urlValidacion}</p>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:16px;align-items:start;">
        <div class="card">
          <p class="kpi-label">Observaciones</p>
          <p style="margin:0;font-size:14px;color:#111827;">${data.notas || "Sin observaciones registradas."}</p>
        </div>
        <div class="card">
          <p class="kpi-label">Documentos Adjuntos</p>
          <ul style="margin:0;padding-left:18px;color:#111827;font-size:14px;">
            ${documentosHtml}
          </ul>
        </div>
      </div>

      <div class="footer">
        Documento generado desde JBM. Usa "Guardar como PDF" en el dialogo de impresion si necesitas archivo.
      </div>
    </div>
  `;
}
