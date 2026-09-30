/**
 * Alertas por umbral mínimo de Cámara Fría.
 *
 * Lógica pura para evaluar existencias contra el umbral de seguridad,
 * más persistencia local (umbral y preferencia de sonido) y el chime
 * de dos tonos (587 Hz → 880 Hz) vía Web Audio API.
 */

/** Umbral global por defecto: 10 cajas. */
export const UMBRAL_DEFECTO = 10;
export const CLAVE_UMBRAL = "camara.umbral_minimo";
export const CLAVE_SONIDO = "camara.alerta_sonora";

export interface ItemStock {
  id: string;
  cajas: number;
}

export interface EvaluacionUmbral {
  bajoUmbral: boolean;
  /** Unidades que faltan para alcanzar el umbral (0 si está en nivel). */
  deficit: number;
  /** % faltante sobre el umbral (0 si está en nivel). */
  pctFaltante: number;
}

const redondear1 = (valor: number): number =>
  Math.round((Number.isFinite(valor) ? valor : 0) * 10) / 10;

export function evaluarUmbral(cajas: number, umbral: number): EvaluacionUmbral {
  const stock = Number.isFinite(cajas) ? cajas : 0;
  const limite = Number.isFinite(umbral) ? Math.max(0, umbral) : 0;

  if (limite <= 0 || stock >= limite) {
    return { bajoUmbral: false, deficit: 0, pctFaltante: 0 };
  }

  const deficit = limite - stock;
  return {
    bajoUmbral: true,
    deficit,
    pctFaltante: redondear1((deficit / limite) * 100),
  };
}

/** Ids de partidas por debajo del umbral. */
export function idsBajoUmbral(items: ItemStock[], umbral: number): string[] {
  return (items ?? []).filter((i) => evaluarUmbral(i.cajas, umbral).bajoUmbral).map((i) => i.id);
}

export function contarBajoUmbral(items: ItemStock[], umbral: number): number {
  return idsBajoUmbral(items, umbral).length;
}

function leerNumeroLocal(clave: string, defecto: number): number {
  try {
    const crudo = localStorage.getItem(clave);
    if (crudo === null) return defecto;
    const valor = Number(crudo);
    return Number.isFinite(valor) && valor >= 0 ? valor : defecto;
  } catch {
    return defecto;
  }
}

function guardarLocal(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Almacenamiento no disponible: la preferencia solo vive en memoria.
  }
}

export function leerUmbralGlobal(): number {
  return leerNumeroLocal(CLAVE_UMBRAL, UMBRAL_DEFECTO);
}

export function guardarUmbralGlobal(umbral: number): void {
  guardarLocal(CLAVE_UMBRAL, String(Math.max(0, Math.trunc(umbral) || 0)));
}

export function leerSonidoActivado(): boolean {
  try {
    const crudo = localStorage.getItem(CLAVE_SONIDO);
    return crudo === null ? true : crudo === "1";
  } catch {
    return true;
  }
}

export function guardarSonidoActivado(activado: boolean): void {
  guardarLocal(CLAVE_SONIDO, activado ? "1" : "0");
}

interface VentanaAudio {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
}

/**
 * Emite el chime de alerta (dos tonos no invasivos). Devuelve `true` si
 * logró reproducirse; `false` cuando no hay Web Audio (p. ej. pruebas).
 */
export function emitirChime(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const w = window as unknown as VentanaAudio;
    const Constructor = w.AudioContext ?? w.webkitAudioContext;
    if (!Constructor) return false;

    const ctx = new Constructor();
    const base = ctx.currentTime;
    [587, 880].forEach((frecuencia, i) => {
      const oscilador = ctx.createOscillator();
      const ganancia = ctx.createGain();
      oscilador.type = "sine";
      oscilador.frequency.value = frecuencia;
      const inicio = base + i * 0.18;
      ganancia.gain.setValueAtTime(0.0001, inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.2, inicio + 0.03);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
      oscilador.connect(ganancia);
      ganancia.connect(ctx.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.2);
    });
    return true;
  } catch {
    return false;
  }
}
