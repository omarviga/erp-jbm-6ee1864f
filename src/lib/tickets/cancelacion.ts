// Reglas cliente del flujo de cancelación de tickets.
// El servidor revalida todo en el RPC `cancelar_ticket`; esto solo da
// retroalimentación inmediata en la UI.

/** Largo mínimo del motivo (igual que el CHECK de ticket_cancelaciones). */
export const MOTIVO_CANCELACION_MINIMO = 5;

/** Errores accionables del motivo; vacío = válido. */
export function validarMotivoCancelacion(motivo: string): string[] {
  if (motivo.trim().length < MOTIVO_CANCELACION_MINIMO) {
    return [
      `El motivo de cancelación es obligatorio (mínimo ${MOTIVO_CANCELACION_MINIMO} caracteres).`,
    ];
  }
  return [];
}

/**
 * La UI solo ofrece cancelar cuando la nota no tiene pagos aplicados.
 * El RPC revalida además liquidación y entrada a producción.
 */
export function esNotaCancelacionSinPagos(montoPagado: number): boolean {
  return !(montoPagado > 0.009);
}
