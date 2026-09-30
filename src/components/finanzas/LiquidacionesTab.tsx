import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProductores, type Productor } from "@/hooks/useProductores";
import { useToast } from "@/hooks/use-toast";
import { openPrintDocument } from "@/lib/print/openPrintDocument";
import { renderEstadoCuentaHtml } from "@/lib/print/renderEstadoCuentaHtml";
import { descargarDeduccionExcel } from "@/lib/export/deduccionExcel";
import { nombreProductorDisplay } from "@/lib/finanzas/calculos";
import {
  construirCuentasCorrientes,
  construirDetalleTickets,
  loteAMovimiento,
  type FilaAbono,
  type FilaCxp,
  type FilaDetalleTicket,
  type FilaLote,
  type FilaProductor,
} from "@/lib/finanzas/mapeo";
import { AuxiliarProductores } from "./AuxiliarProductores";
import { ReporteDeduccionOperativa, type FilaReporteExport } from "./ReporteDeduccionOperativa";

type ProductorConAlias = Productor & { alias?: string | null };

/**
 * Pestaña Liquidaciones: auxiliar contable y consolidado de deducción
 * operativa con datos reales. La captura de liquidaciones y abonos se
 * conecta cuando se defina el modelo de persistencia (ver Finanzas).
 */
export function LiquidacionesTab() {
  const { toast } = useToast();
  const { productores, loading: cargandoProductores } = useProductores();

  const { data: cxp = [], isLoading: cargandoCxp } = useQuery({
    queryKey: ["finanzas", "cxp"],
    queryFn: async (): Promise<FilaCxp[]> => {
      const { data, error } = await supabase
        .from("cuentas_por_pagar")
        .select("id, productor_id, lote_id, numero_lote, fecha_ticket, kilos_netos, precio_kg, monto_total, monto_pagado, saldo_pendiente")
        .neq("estado", "cancelado")
        .order("fecha_ticket", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FilaCxp[];
    },
  });

  const { data: lotes = [], isLoading: cargandoLotes } = useQuery({
    queryKey: ["finanzas", "lotes"],
    queryFn: async (): Promise<FilaLote[]> => {
      const { data, error } = await supabase
        .from("lotes")
        .select("id, productor_id, folio_fisico, fecha_recepcion, peso_bruto, peso_tara, peso_neto, costo_bascula, bascula_forma_pago, cuota_maniobra_kg, cuota_maniobra_total")
        .order("fecha_recepcion", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FilaLote[];
    },
  });

  const { data: cancelados = [] } = useQuery({
    queryKey: ["finanzas", "cancelaciones"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("ticket_cancelaciones")
        .select("lote_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.lote_id);
    },
  });

  const { data: abonos = [], isLoading: cargandoAbonos } = useQuery({
    queryKey: ["finanzas", "abonos"],
    queryFn: async (): Promise<FilaAbono[]> => {
      const { data, error } = await supabase
        .from("abonos_productor")
        .select("productor_id, monto")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FilaAbono[];
    },
  });

  const filasProductor: FilaProductor[] = useMemo(
    () =>
      (productores as ProductorConAlias[]).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        alias: p.alias ?? null,
      })),
    [productores],
  );

  const cuentas = useMemo(
    () => construirCuentasCorrientes(filasProductor, cxp, abonos),
    [filasProductor, cxp, abonos],
  );

  const lotesVigentes = useMemo(() => {
    if (cancelados.length === 0) return lotes;
    const set = new Set(cancelados);
    return lotes.filter((l) => !set.has(l.id));
  }, [lotes, cancelados]);

  const movimientos = useMemo(() => lotesVigentes.map(loteAMovimiento), [lotesVigentes]);

  const nombres = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of filasProductor) {
      map[p.id] = nombreProductorDisplay({ id: p.id, alias: p.alias, nombreLegal: p.nombre });
    }
    return map;
  }, [filasProductor]);

  const detalle = useMemo(
    () => construirDetalleTickets(cxp, lotesVigentes, nombres),
    [cxp, lotesVigentes, nombres],
  );

  const descargarEstadoCuenta = async (productorId: string) => {
    const productor = (productores as ProductorConAlias[]).find((p) => p.id === productorId);
    if (!productor) return;
    try {
      const [{ data: notasData, error: errorNotas }, { data: abonosData, error: errorAbonos }] =
        await Promise.all([
          supabase
            .from("cuentas_por_pagar")
            .select("numero_lote, fecha_ticket, kilos_netos, precio_kg, monto_total, monto_pagado, saldo_pendiente")
            .eq("productor_id", productorId)
            .order("fecha_ticket", { ascending: true }),
          supabase
            .from("abonos_productor")
            .select("monto, metodo_pago, referencia, created_at")
            .eq("productor_id", productorId)
            .order("created_at", { ascending: true }),
        ]);
      if (errorNotas) throw errorNotas;
      if (errorAbonos) throw errorAbonos;

      const notas = (notasData || []).map((n) => ({
        fecha: new Date(n.fecha_ticket).toLocaleDateString("es-MX"),
        folio: n.numero_lote || "N/A",
        kilos: n.kilos_netos || 0,
        precio: n.precio_kg || 0,
        importe: n.monto_total || 0,
        pagado: n.monto_pagado || 0,
        saldo: n.saldo_pendiente || 0,
      }));
      const pagos = (abonosData || []).map((a) => ({
        fecha: new Date(a.created_at).toLocaleDateString("es-MX"),
        metodo: a.metodo_pago || "efectivo",
        referencia: a.referencia || "—",
        monto: a.monto || 0,
      }));
      const fechas = (notasData || []).map((n) => new Date(n.fecha_ticket).getTime()).filter(Boolean);

      openPrintDocument(
        `EstadoCuenta_${productor.nombre.replace(/\s+/g, "_")}.pdf`,
        renderEstadoCuentaHtml({
          productor: { nombre: productor.nombre, rfc: productor.rfc || "XAXX010101000" },
          periodo: {
            inicio: fechas.length > 0 ? new Date(Math.min(...fechas)).toLocaleDateString("es-MX") : new Date().toLocaleDateString("es-MX"),
            fin: new Date().toLocaleDateString("es-MX"),
          },
          notas,
          pagos,
          resumen: {
            valorFruta: notas.reduce((s, n) => s + n.importe, 0),
            totalPagado: pagos.reduce((s, p) => s + p.monto, 0),
            saldoPendiente: notas.reduce((s, n) => s + n.saldo, 0),
          },
        }),
      );
    } catch (error) {
      toast({
        title: "❌ Error",
        description: (error as { message?: string })?.message || "No se pudo generar el estado de cuenta",
        variant: "destructive",
      });
    }
  };

  const exportarDeduccionExcel = (
    periodo: string,
    filas: FilaReporteExport[],
    detallePeriodo: FilaDetalleTicket[],
  ) =>
    descargarDeduccionExcel(
      periodo,
      filas.map((f) => ({
        productor: f.display,
        boletas: f.nBoletas,
        kilos: f.kilosNetos,
        deduccion: f.deduccion,
      })),
      detallePeriodo,
    );

  if (cargandoProductores || cargandoCxp || cargandoLotes || cargandoAbonos) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando liquidaciones...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Cuentas corrientes de productores y consolidado de deducción operativa por periodo.
      </p>
      <AuxiliarProductores cuentas={cuentas} onEstadoCuenta={(id) => void descargarEstadoCuenta(id)} />
      <ReporteDeduccionOperativa
        movimientos={movimientos}
        nombres={nombres}
        detalle={detalle}
        onExportarExcel={(periodo, filas, detallePeriodo) =>
          void exportarDeduccionExcel(periodo, filas, detallePeriodo)
        }
      />
    </div>
  );
}
