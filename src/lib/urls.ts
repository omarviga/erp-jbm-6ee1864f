/**
 * URLs públicas del ERP.
 *
 * `ERP_BASE_URL` es la dirección base obligatoria de TODOS los códigos
 * QR que genera el sistema (recepción, trazabilidad, carta porte).
 * Ningún QR debe construirse con otro host ni con `window.location`.
 */

/** Dominio público del ERP. */
export const ERP_BASE_URL = "https://erp.jbm.com.mx";

/** Estatus de pago / descarga de PDF de una boleta de recepción. */
export const urlEstatusRecepcion = (folioOficial: string): string =>
  `${ERP_BASE_URL}/status/${folioOficial.trim().toLowerCase()}`;

/** Expediente público de un lote (trazabilidad). */
export const urlLote = (idOrNumero: string): string =>
  `${ERP_BASE_URL}/lotes/${idOrNumero}`;

/** Validación en línea de una carta porte. */
export const urlCartaPorte = (folio: string): string =>
  `${ERP_BASE_URL}/logistica/carta-porte/${encodeURIComponent(folio)}`;
