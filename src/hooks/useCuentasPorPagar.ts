import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CuentaPorPagar {
  id: string;
  lote_id: string;
  productor_id: string;
  fecha_ticket: string;
  numero_lote: string;
  kilos_netos: number;
  kilos_pagables: number;
  precio_kg: number;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  estado: "pendiente" | "parcial" | "liquidado" | "conciliado";
  created_at: string;
}

export interface AbonoProductor {
  id: string;
  productor_id: string;
  monto: number;
  metodo_pago: string;
  referencia: string | null;
  comprobante_url: string | null;
  notas: string | null;
  created_at: string;
}

export interface ResumenProductorCxP {
  productor_id: string;
  nombre: string;
  total_deuda: number;
  total_pagado: number;
  saldo_vivo: number;
  tickets_pendientes: number;
  ticket_mas_viejo: string | null;
}

export function useCuentasPorPagar(productorId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // CxP de un productor específico (FIFO por fecha_ticket)
  const cxpQuery = useQuery({
    queryKey: ["cuentas_por_pagar", productorId],
    queryFn: async () => {
      if (!productorId) return [];
      const { data, error } = await (supabase as any)
        .from("cuentas_por_pagar")
        .select("*")
        .eq("productor_id", productorId)
        .order("fecha_ticket", { ascending: true });
      if (error) throw error;
      return data as CuentaPorPagar[];
    },
    enabled: !!productorId,
  });

  // Resumen global de todos los productores con deuda
  const resumenQuery = useQuery({
    queryKey: ["cxp_resumen_global"],
    queryFn: async () => {
      // Get all CxP grouped mentally, but we fetch all + productores
      const { data: cxpData, error: cxpError } = await (supabase as any)
        .from("cuentas_por_pagar")
        .select("*")
        .in("estado", ["pendiente", "parcial"])
        .order("fecha_ticket", { ascending: true });
      if (cxpError) throw cxpError;

      const { data: productoresData, error: prodError } = await supabase
        .from("productores")
        .select("id, nombre");
      if (prodError) throw prodError;

      const prodMap = new Map(productoresData.map((p: any) => [p.id, p.nombre]));

      // Agrupar por productor
      const resumenMap = new Map<string, ResumenProductorCxP>();
      for (const cxp of (cxpData as CuentaPorPagar[])) {
        const existing = resumenMap.get(cxp.productor_id);
        if (existing) {
          existing.total_deuda += cxp.monto_total;
          existing.total_pagado += cxp.monto_pagado;
          existing.saldo_vivo += cxp.saldo_pendiente;
          existing.tickets_pendientes += 1;
          if (!existing.ticket_mas_viejo || cxp.fecha_ticket < existing.ticket_mas_viejo) {
            existing.ticket_mas_viejo = cxp.fecha_ticket;
          }
        } else {
          resumenMap.set(cxp.productor_id, {
            productor_id: cxp.productor_id,
            nombre: prodMap.get(cxp.productor_id) || "Desconocido",
            total_deuda: cxp.monto_total,
            total_pagado: cxp.monto_pagado,
            saldo_vivo: cxp.saldo_pendiente,
            tickets_pendientes: 1,
            ticket_mas_viejo: cxp.fecha_ticket,
          });
        }
      }

      return Array.from(resumenMap.values()).sort((a, b) => b.saldo_vivo - a.saldo_vivo);
    },
  });

  // Abonos de un productor
  const abonosQuery = useQuery({
    queryKey: ["abonos_productor", productorId],
    queryFn: async () => {
      if (!productorId) return [];
      const { data, error } = await (supabase as any)
        .from("abonos_productor")
        .select("*")
        .eq("productor_id", productorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AbonoProductor[];
    },
    enabled: !!productorId,
  });

  // Registrar abono con asignación FIFO automática
  const registrarAbono = useMutation({
    mutationFn: async (params: {
      productor_id: string;
      monto: number;
      metodo_pago: string;
      referencia?: string;
      notas?: string;
      asignacion_manual?: { cxp_id: string; monto: number }[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      // 1. Crear el abono
      const { data: abono, error: abonoError } = await (supabase as any)
        .from("abonos_productor")
        .insert({
          productor_id: params.productor_id,
          monto: params.monto,
          metodo_pago: params.metodo_pago,
          referencia: params.referencia || null,
          notas: params.notas || null,
          usuario_id: userData.user?.id || null,
        })
        .select()
        .single();
      if (abonoError) throw abonoError;

      // 2. Asignar a CxP (FIFO o manual)
      let asignaciones: { cxp_id: string; monto: number }[];

      if (params.asignacion_manual && params.asignacion_manual.length > 0) {
        asignaciones = params.asignacion_manual;
      } else {
        // FIFO: obtener CxP pendientes del productor ordenadas por fecha
        const { data: cxpPendientes, error: cxpError } = await (supabase as any)
          .from("cuentas_por_pagar")
          .select("id, saldo_pendiente")
          .eq("productor_id", params.productor_id)
          .in("estado", ["pendiente", "parcial"])
          .order("fecha_ticket", { ascending: true });
        if (cxpError) throw cxpError;

        asignaciones = [];
        let restante = params.monto;
        for (const cxp of cxpPendientes) {
          if (restante <= 0) break;
          const aplicar = Math.min(restante, cxp.saldo_pendiente);
          asignaciones.push({ cxp_id: cxp.id, monto: aplicar });
          restante -= aplicar;
        }
      }

      // 3. Insertar asignaciones y actualizar CxP
      for (const asig of asignaciones) {
        const { error: asigError } = await (supabase as any)
          .from("abono_asignaciones")
          .insert({
            abono_id: abono.id,
            cxp_id: asig.cxp_id,
            monto_aplicado: asig.monto,
          });
        if (asigError) throw asigError;

        // Actualizar saldo en CxP
        const { data: cxpActual, error: fetchError } = await (supabase as any)
          .from("cuentas_por_pagar")
          .select("monto_total, monto_pagado")
          .eq("id", asig.cxp_id)
          .single();
        if (fetchError) throw fetchError;

        const nuevoMontoPagado = (cxpActual.monto_pagado || 0) + asig.monto;
        const nuevoSaldo = cxpActual.monto_total - nuevoMontoPagado;
        const nuevoEstado = nuevoSaldo <= 0 ? "liquidado" : "parcial";

        const { error: updateError } = await (supabase as any)
          .from("cuentas_por_pagar")
          .update({
            monto_pagado: nuevoMontoPagado,
            saldo_pendiente: Math.max(0, nuevoSaldo),
            estado: nuevoEstado,
          })
          .eq("id", asig.cxp_id);
        if (updateError) throw updateError;
      }

      // 4. Actualizar saldo_pendiente global del productor
      const { data: sumData, error: sumError } = await (supabase as any)
        .from("cuentas_por_pagar")
        .select("saldo_pendiente")
        .eq("productor_id", params.productor_id)
        .in("estado", ["pendiente", "parcial"]);
      if (sumError) throw sumError;

      const nuevoSaldoGlobal = (sumData as any[]).reduce((sum: number, r: any) => sum + r.saldo_pendiente, 0);
      await supabase
        .from("productores")
        .update({ saldo_pendiente: nuevoSaldoGlobal })
        .eq("id", params.productor_id);

      return abono;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas_por_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["cxp_resumen_global"] });
      queryClient.invalidateQueries({ queryKey: ["abonos_productor"] });
      queryClient.invalidateQueries({ queryKey: ["productores"] });
      toast({ title: "Abono registrado", description: "El pago se aplicó correctamente a las cuentas por pagar." });
    },
    onError: (error: Error) => {
      toast({ title: "Error al registrar abono", description: error.message, variant: "destructive" });
    },
  });

  // Generar datos para PDF de estado de cuenta
  const generarDatosEstadoCuenta = (
    cxpList: CuentaPorPagar[],
    abonosList: AbonoProductor[],
    periodo: { inicio: string; fin: string }
  ) => {
    const movimientos: any[] = [];

    // Entregas (cargos)
    for (const cxp of cxpList) {
      const fecha = new Date(cxp.fecha_ticket);
      if (fecha >= new Date(periodo.inicio) && fecha <= new Date(periodo.fin)) {
        movimientos.push({
          fecha: fecha.toLocaleDateString("es-MX"),
          folio: cxp.numero_lote,
          concepto: `Entrega de Fruta – ${cxp.kilos_pagables.toLocaleString("es-MX")} kg @ $${cxp.precio_kg}/kg`,
          cargos: 0,
          abonos: cxp.monto_total,
          saldo: 0,
        });
      }
    }

    // Pagos (abonos)
    for (const abono of abonosList) {
      const fecha = new Date(abono.created_at);
      if (fecha >= new Date(periodo.inicio) && fecha <= new Date(periodo.fin)) {
        movimientos.push({
          fecha: fecha.toLocaleDateString("es-MX"),
          folio: abono.referencia || "S/R",
          concepto: `Pago ${abono.metodo_pago} – Ref: ${abono.referencia || "N/A"}`,
          cargos: abono.monto,
          abonos: 0,
          saldo: 0,
        });
      }
    }

    // Ordenar cronológicamente
    movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Calcular saldos corridos
    const totalAbonos = movimientos.reduce((s, m) => s + m.abonos, 0);
    const totalCargos = movimientos.reduce((s, m) => s + m.cargos, 0);

    return {
      movimientos,
      resumen: {
        saldoInicial: 0,
        totalAbonos,
        totalCargos,
        saldoFinal: totalAbonos - totalCargos,
      },
    };
  };

  return {
    cxp: cxpQuery.data || [],
    cxpLoading: cxpQuery.isLoading,
    resumenGlobal: resumenQuery.data || [],
    resumenLoading: resumenQuery.isLoading,
    abonos: abonosQuery.data || [],
    abonosLoading: abonosQuery.isLoading,
    registrarAbono,
    generarDatosEstadoCuenta,
  };
}
