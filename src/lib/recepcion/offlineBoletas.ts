import type { TicketReciente } from "@/hooks/useTicketsRecientes";
import type { DatosRecepcion } from "@/hooks/useRecepcion";

/**
 * Almacenamiento híbrido del historial de boletas.
 *
 * Cuando la báscula opera sin conexión, la recepción se guarda en
 * IndexedDB (con respaldo en localStorage para entornos sin IDB como
 * jsdom/SSR) y se une al listado del servidor con indicador OFFLINE
 * hasta su sincronización manual.
 */

export interface BoletaOffline {
  /** Id local, prefijo `offline-` + timestamp. */
  id: string;
  fechaGuardado: string;
  /** Payload original para reintentar el guardado en el servidor. */
  datos: DatosRecepcion;
  /** Vista lista para el historial (misma forma que el servidor). */
  vista: TicketReciente;
}

const DB_NOMBRE = "jbm-recepcion";
const DB_STORE = "boletas";
const LS_CLAVE = "jbm:recepcion:offline:v1";

const hayIndexedDB = (): boolean =>
  typeof indexedDB !== "undefined" && typeof window !== "undefined";

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function conStore(
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<unknown> {
  const db = await abrirDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, modo);
      const req = fn(tx.objectStore(DB_STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// ---------- Respaldo localStorage (jsdom / SSR / IDB bloqueado) ----------

function leerLS(): BoletaOffline[] {
  try {
    const raw = localStorage.getItem(LS_CLAVE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BoletaOffline[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escribirLS(boletas: BoletaOffline[]): void {
  try {
    localStorage.setItem(LS_CLAVE, JSON.stringify(boletas));
  } catch {
    // Almacenamiento lleno o bloqueado: se conserva en memoria del hook.
  }
}

export const crearIdOffline = (): string =>
  `offline-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export async function listarBoletasOffline(): Promise<BoletaOffline[]> {
  if (!hayIndexedDB()) return leerLS();
  try {
    const res = (await conStore("readonly", (s) =>
      s.getAll()
    )) as BoletaOffline[];
    return Array.isArray(res) ? res : [];
  } catch {
    return leerLS();
  }
}

export async function guardarBoletaOffline(
  boleta: BoletaOffline
): Promise<void> {
  if (!hayIndexedDB()) {
    const actual = leerLS().filter((b) => b.id !== boleta.id);
    escribirLS([...actual, boleta]);
    return;
  }
  try {
    await conStore("readwrite", (s) => s.put(boleta));
  } catch {
    const actual = leerLS().filter((b) => b.id !== boleta.id);
    escribirLS([...actual, boleta]);
  }
  // Espejo en LS para lectura síncrona rápida del primer render.
  const actual = leerLS().filter((b) => b.id !== boleta.id);
  escribirLS([...actual, boleta]);
}

export async function eliminarBoletaOffline(id: string): Promise<void> {
  if (hayIndexedDB()) {
    try {
      await conStore("readwrite", (s) => s.delete(id));
    } catch {
      // Sigue al respaldo LS.
    }
  }
  escribirLS(leerLS().filter((b) => b.id !== id));
}

/** Lectura síncrona del espejo LS para el primer render sin parpadeo. */
export function leerEspejoOffline(): BoletaOffline[] {
  if (typeof localStorage === "undefined") return [];
  return leerLS();
}
