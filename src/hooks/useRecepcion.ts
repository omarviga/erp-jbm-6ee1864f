import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useQuery } from '@tanstack/react-query';

type Lote = Database['public']['Tables']['lotes']['Row'];

export interface DatosRecepcion {
  productor_id: string;
  peso_bruto: number;
  peso_tara: number;
  precio_pactado_kg: number;
  zona_asignada: string;
  costo_bascula: number;
  folio_fisico?: string;
  calidad_defectos?: number;
  origen?: string;
  estado_calidad?: string;
  notas?: string;
  huerto_id?: string;
  peso_neto_fisico?: number;
  peso_pagable?: number;
  kilos_merma?: number;
}

export interface ResumenRecepcion {
  pesoNeto: number;
  subtotal: number;
  costoBascula: number;
  totalLote: number;
  saldoAnticipoAplicado: number;
  totalAPagar: number;
}

export function useRecepcion() {
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  // Fetch huertos
  const { data: huertos = [] } = useQuery({
    queryKey: ['huertos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('huertos')
        .select('*')
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  // Fetch cortadores
  const { data: cortadores = [] } = useQuery({
    queryKey: ['cortadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cortadores')
        .select('*')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const guardarLote = async (datos: DatosRecepcion) => {
    setLoadingGuardar(true);
    setErrorGuardar(null);

    try {
      if (!datos.productor_id || !datos.peso_bruto) {
        throw new Error("Faltan datos obligatorios");
      }

      const peso_neto = datos.peso_bruto - (datos.peso_tara || 0);
      if (peso_neto <= 0) throw new Error("Peso neto inválido");

      const numero_lote = `L-${Date.now().toString().slice(-6)}-${Math.floor(
        Math.random() * 1000
      )
        .toString()
        .padStart(3, "0")}`;

      const { data: userData } = await supabase.auth.getUser();

      const loteData = {
        productor_id: datos.productor_id,
        huerto_id: datos.huerto_id || null,
        peso_bruto: datos.peso_bruto,
        peso_tara: datos.peso_tara || 0,
        precio_pactado_kg: datos.precio_pactado_kg || 0,
        zona_asignada: datos.zona_asignada || "anden_descarga",
        costo_bascula: datos.costo_bascula || 0,
        folio_fisico: datos.folio_fisico || "",
        calidad_defectos: datos.calidad_defectos || 0,
        origen: datos.origen || "externo",
        estado_calidad: datos.estado_calidad || "aceptado",
        notas: datos.notas || "",
        peso_pagable: datos.peso_pagable || 0,
        kilos_merma: datos.kilos_merma || 0,
        numero_lote,
        fecha_recepcion: new Date().toISOString(),
        estado: "pendiente" as const,
        usuario_id: userData.user?.id ?? null,
      };

      const { data, error } = await supabase
        .from("lotes")
        .insert([loteData])
        .select("*, productores:productor_id(nombre)")
        .single();

      if (error) throw error;

      // Crear cuenta por pagar al productor desde la recepción
      const pesoPagable = datos.peso_pagable ?? peso_neto;
      const subtotalLote = Math.max(0, pesoPagable * (datos.precio_pactado_kg || 0));
      const totalCuentaPorPagar = Math.max(0, subtotalLote - (datos.costo_bascula || 0));

      if (totalCuentaPorPagar > 0) {
        const { data: productorActual, error: errorProductorActual } = await supabase
          .from("productores")
          .select("saldo_pendiente")
          .eq("id", datos.productor_id)
          .single();

        if (errorProductorActual) throw errorProductorActual;

        const nuevoSaldoPendiente = (productorActual?.saldo_pendiente || 0) + totalCuentaPorPagar;
        const { error: errorActualizarSaldo } = await supabase
          .from("productores")
          .update({ saldo_pendiente: nuevoSaldoPendiente })
          .eq("id", datos.productor_id);

        if (errorActualizarSaldo) throw errorActualizarSaldo;
      }

      return data;
    } catch (err: any) {
      setErrorGuardar(err.message);
      throw err;
    } finally {
      setLoadingGuardar(false);
    }
  };

  // 🔹 Obtener costo de báscula (configurable a futuro)
  const obtenerCostoBasculaConfigurado = async (): Promise<number> => {
    return 50;
  };

  // 🔹 Cálculo completo del lote
  const calcularResumenRecepcion = (
    pesoBruto: number,
    pesoTara: number,
    precioKg: number,
    costoBascula: number,
    saldoAnticipo: number
  ): ResumenRecepcion => {
    const pesoNeto = pesoBruto - pesoTara;
    const subtotal = pesoNeto * precioKg;
    const totalLote = subtotal - costoBascula;

    const saldoAnticipoAplicado = Math.min(saldoAnticipo, totalLote);
    const totalAPagar = totalLote - saldoAnticipoAplicado;

    return {
      pesoNeto,
      subtotal,
      costoBascula,
      totalLote,
      saldoAnticipoAplicado,
      totalAPagar,
    };
  };

  return {
    guardarLote,
    obtenerCostoBasculaConfigurado,
    calcularResumenRecepcion,
    huertos,
    cortadores,
    loading: loadingGuardar,
    error: errorGuardar,
  };
}
