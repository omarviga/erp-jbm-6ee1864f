const BASE_PRINT_STYLES = `
  :root {
    color-scheme: light;
    font-family: Arial, Helvetica, sans-serif;
    color: #1f2937;
    background: #ffffff;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 24px;
    background: #f8fafc;
  }

  .page {
    max-width: 960px;
    margin: 0 auto;
    background: #ffffff;
    padding: 32px;
    border: 1px solid #e5e7eb;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 2px solid #16a34a;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }

  .muted {
    color: #6b7280;
  }

  .title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
  }

  .subtitle {
    margin: 6px 0 0;
    font-size: 14px;
  }

  .grid {
    display: grid;
    gap: 16px;
  }

  .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 14px;
    background: #ffffff;
  }

  .card.soft {
    background: #f8fafc;
  }

  .kpi-label {
    margin: 0 0 6px;
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .kpi-value {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
  }

  th, td {
    border-bottom: 1px solid #e5e7eb;
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
    font-size: 13px;
  }

  th {
    background: #f8fafc;
    color: #374151;
    font-weight: 700;
  }

  .text-right {
    text-align: right;
  }

  .footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    font-size: 12px;
    color: #6b7280;
  }

  @media print {
    body {
      background: #ffffff;
      padding: 0;
    }

    .page {
      border: 0;
      max-width: none;
      padding: 0;
    }
  }
`;

export function openPrintDocument(title: string, bodyHtml: string) {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style>${BASE_PRINT_STYLES}</style>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
    return;
  }

  // Fallback para entornos que bloquean popups: imprimir desde iframe oculto.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    document.body.removeChild(iframe);
    throw new Error("No se pudo abrir la ventana de impresion");
  }

  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();

  frameWindow.focus();
  frameWindow.onload = () => {
    frameWindow.print();
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };
}
