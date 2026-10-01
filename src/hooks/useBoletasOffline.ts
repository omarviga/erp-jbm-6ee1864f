import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TicketReciente } from "./useTicketsRecientes";
import type { DatosRecepcion, ResultadoRecepcion } from "./useRecepcion";
import {
  crearIdOffline,
  eliminarBoletaOffline,
  guardarBoletaOffline,
  leerEspejoOffline,
  listarBoletasOffline,
  type BoletaOffline,
} from "@/lib/recepcion/offlineBoletas";

/** Ticket del servidor marcado como pendiente de sincronización. */
export type TicketHistorial = TicketReciente & { offline?: boolean };

const enLinea = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

/**
 * Boletas capturadas sin conexión (IndexedDB) + sincronización manual.
 *
 * `guardarFn` es el guardado normal del servidor; al sincronizar cada
 * boleta offline se reintenta con su payload original y, si tiene
 * éxito, se elimina del almacén local.
 */
export function useBoletasOffline(
  guardarFn?: (datos: DatosRecepcion) => Promise<ResultadoRecepcion>
) {
  const queryClient = useQueryClient();
  const [boletas, setBoletas] = useState<BoletaOffline[]>(() =>
    leerEspejoOffline()
  );
  // El espejo localStorage es síncrono y autoritativo (toda escritura
  // lo actualiza): no hay espera inicial; la lectura IDB solo refresca.
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [online, setOnline] = useState(enLinea);

  useEffect(() => {
    let vivo = true;
    listarBoletasOffline()
      .then((lista) => {
        if (vivo) setBoletas(lista);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const actualizar = () => setOnline(enLinea());
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  const guardar = useCallback(async (datos: DatosRecepcion, vista: TicketReciente) => {
    const boleta: BoletaOffline = {
      id: vista.id.startsWith("offline-") ? vista.id : crearIdOffline(),
      fechaGuardado: new Date().toISOString(),
      datos,
      vista: { ...vista, id: vista.id.startsWith("offline-") ? vista.id : "" },
    };
    if (!boleta.vista.id) boleta.vista.id = boleta.id;
    await guardarBoletaOffline(boleta);
    setBoletas((prev) => [...prev.filter((b) => b.id !== boleta.id), boleta]);
    return boleta;
  }, []);

  const eliminar = useCallback(async (id: string) => {
    await eliminarBoletaOffline(id);
    setBoletas((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const sincronizar = useCallback(async (): Promise<{
    ok: number;
    fallos: number;
  }> => {
    if (!guardarFn) return { ok: 0, fallos: 0 };
    setSincronizando(true);
    let ok = 0;
    let fallos = 0;
    const pendientes = [...boletas];
    for (const b of pendientes) {
      try {
        await guardarFn(b.datos);
        await eliminarBoletaOffline(b.id);
        setBoletas((prev) => prev.filter((x) => x.id !== b.id));
        ok += 1;
      } catch {
        fallos += 1;
      }
    }
    setSincronizando(false);
    if (ok > 0) {
      queryClient.invalidateQueries({ queryKey: ["recepcion"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
    }
    return { ok, fallos };
  }, [boletas, guardarFn, queryClient]);

  const vistas: TicketHistorial[] = boletas.map((b) => ({
    ...b.vista,
    offline: true,
  }));

  return {
    offline: vistas,
    totalOffline: vistas.length,
    cargandoOffline: cargando,
    enLinea: online,
    sincronizando,
    guardarOffline: guardar,
    eliminarOffline: eliminar,
    sincronizar,
  };
}
