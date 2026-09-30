/**
 * Resumen del módulo de Logística.
 *
 * KPIs reales sobre guías de salida (últimas 500), filtro del historial
 * por texto/estado y exportación CSV contable (formato plano con `;`,
 * listo para CONTPAQi / Aspel / SAP).
 */

export interface ResumenGuia {
  id: string;
  folio?: string | null;
  numero_guia?: string | null;
  estado?: string | null;
  total_cajas?: number | null;
  peso_total?: number | null;
  valor_total?: number | null;
  certificado_fitosanitario?: boolean | null;
  lugar_origen?: string | null;
  lugar_destino?: string | null;
  created_at?: string | null;
  clientes?: { nombre: string | null } | null;
}

/** Estados con unidad activa en carretera o andén. */
export const ESTADOS_ACTIVOS = ["generada", "validada"];

export interface KpisLogistica {
  /** Guías generadas/validadas no canceladas. */
  embarquesActivos: number;
  cajasDespachadas: number;
  toneladas: number;
  /** % de guías evaluables con certificado fitosanitario. null sin datos. */
  cumplimientoFito: number | null;
}

const redondear1 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 10) / 10;

const aNumero = (valor: number | null | undefined): number =>
  Number.isFinite(Number(valor)) ? Number(valor) : 0;

export const folioGuia = (guia: Pick<ResumenGuia, "folio" | "numero_guia">): string =>
  guia.folio || guia.numero_guia || "—";

export function calcularKpisLogistica(guias: ResumenGuia[]): KpisLogistica {
  const filas = guias ?? [];
  const activas = filas.filter((g) => ESTADOS_ACTIVOS.includes(String(g.estado ?? "").toLowerCase()));

  const cajas = activas.reduce((acc, g) => acc + aNumero(g.total_cajas), 0);
  const kilos = activas.reduce((acc, g) => acc + aNumero(g.peso_total), 0);

  const evaluables = filas.filter((g) => String(g.estado ?? "").toLowerCase() !== "cancelada");
  const conCertificado = evaluables.filter((g) => g.certificado_fitosanitario === true).length;

  return {
    embarquesActivos: activas.length,
    cajasDespachadas: Math.trunc(cajas),
    toneladas: redondear1(kilos / 1000),
    cumplimientoFito:
      evaluables.length > 0 ? redondear1((conCertificado / evaluables.length) * 100) : null,
  };
}

export interface FiltroGuias {
  texto: string;
  estado: string;
}

/** Filtra por folio/cliente (insensible) y estado exacto (`todos` = sin filtro). */
export function filtrarGuias(guias: ResumenGuia[], filtro: FiltroGuias): ResumenGuia[] {
  const term = filtro.texto.trim().toLowerCase();
  const estado = filtro.estado;

  return (guias ?? []).filter((g) => {
    if (estado !== "todos" && String(g.estado ?? "").toLowerCase() !== estado) return false;
    if (!term) return true;
    const folio = folioGuia(g).toLowerCase();
    const cliente = String(g.clientes?.nombre ?? "").toLowerCase();
    return folio.includes(term) || cliente.includes(term);
  });
}

const decimalMx = (valor: number, decimales = 2): string =>
  valor.toFixed(decimales).replace(".", ",");

const fechaCorta = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-MX");
};

/** CSV contable: una fila por guía con columnas estables. */
export function generarCsvContable(guias: ResumenGuia[]): string {
  const encabezado = "Folio;Fecha;Cliente;Origen;Destino;Estado;Cajas;Peso kg;Valor MXN;Fitosanitario";
  const lineas = (guias ?? []).map((g) =>
    [
      folioGuia(g),
      fechaCorta(g.created_at),
      g.clientes?.nombre ?? "",
      g.lugar_origen ?? "",
      g.lugar_destino ?? "",
      String(g.estado ?? ""),
      String(Math.trunc(aNumero(g.total_cajas))),
      decimalMx(aNumero(g.peso_total)),
      decimalMx(aNumero(g.valor_total)),
      g.certificado_fitosanitario === true ? "SI" : "NO",
    ].join(";")
  );
  return `\uFEFF${[encabezado, ...lineas].join("\r\n")}\r\n`;
}
