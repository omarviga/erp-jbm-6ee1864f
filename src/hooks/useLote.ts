import { useState, useEffect, useCallback } from "react";
import {
  getLoteCompleto,
  getProduccionPorLote,
  calcularRentabilidad,
  calcularEstadoVidaUtil,
  getDistribucionPorCalibre,
  LoteCompleto,
  ProduccionItem,
  AnalisisRentabilidad,
  EstadoVidaUtil,
} from "@/services/trazabilidadService";

interface UseLoteResult {
  lote: LoteCompleto | null;
  produccion: ProduccionItem[];
  rentabilidad: AnalisisRentabilidad | null;
  vidaUtil: EstadoVidaUtil | null;
  distribucion: ReturnType<typeof getDistribucionPorCalibre> | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLote(numeroLote: string | undefined): UseLoteResult {
  const [lote, setLote] = useState<LoteCompleto | null>(null);
  const [produccion, setProduccion] = useState<ProduccionItem[]>([]);
  const [rentabilidad, setRentabilidad] = useState<AnalisisRentabilidad | null>(null);
  const [vidaUtil, setVidaUtil] = useState<EstadoVidaUtil | null>(null);
  const [distribucion, setDistribucion] = useState<ReturnType<typeof getDistribucionPorCalibre> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!numeroLote) {
      setLoading(false);
      setError("Número de lote no proporcionado");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Obtener lote completo
      const loteData = await getLoteCompleto(numeroLote);

      if (!loteData) {
        setError("Lote no encontrado");
        setLoading(false);
        return;
      }

      setLote(loteData);

      // Obtener producción asociada
      const produccionData = await getProduccionPorLote(loteData.id);
      setProduccion(produccionData);

      // Calcular rentabilidad
      const rentabilidadData = calcularRentabilidad(loteData, produccionData);
      setRentabilidad(rentabilidadData);

      // Calcular vida útil (basado en fecha de recepción)
      const vidaUtilData = calcularEstadoVidaUtil(loteData.fecha_recepcion);
      setVidaUtil(vidaUtilData);

      // Calcular distribución por calibre
      const distribucionData = getDistribucionPorCalibre(produccionData);
      setDistribucion(distribucionData);

    } catch (err) {
      console.error("Error loading lote data:", err);
      setError("Error al cargar los datos del lote");
    } finally {
      setLoading(false);
    }
  }, [numeroLote]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    lote,
    produccion,
    rentabilidad,
    vidaUtil,
    distribucion,
    loading,
    error,
    refetch: fetchData,
  };
}
