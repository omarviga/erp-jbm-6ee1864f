const SOLO_EMPAQUE_ORIGEN_REGEX =
  /^(caja(?:\s+reja)?|arpilla)(?:\s+\d+(?:\.\d+)?\s*kg)?$/i;

const limpiarNombreBaseGranel = (nombre: string) =>
  nombre
    .replace(/\b\d+(?:\.\d+)?\s*kg\b/gi, "")
    .replace(/\bcaja(?:\s+reja)?\b/gi, "")
    .replace(/\barpilla\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizarNombreMostrador = (nombre: string) => {
  if (!nombre) return "Producto";

  const esGranelMostrador =
    nombre.toLowerCase().startsWith("granel - ")
    || nombre.toLowerCase().startsWith("granel mostrador - ");

  if (!esGranelMostrador) {
    return nombre;
  }

  const nombreBase = nombre.replace(/^granel(?: mostrador)? - /i, "").trim();
  const nombreLimpio = limpiarNombreBaseGranel(nombreBase);

  if (!nombreBase || SOLO_EMPAQUE_ORIGEN_REGEX.test(nombreBase) || !nombreLimpio) {
    return "Limon a granel";
  }

  return `${nombreLimpio} a granel`;
};
