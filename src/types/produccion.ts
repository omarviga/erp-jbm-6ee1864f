// types/production.ts
export interface ProduccionRecord {
    id: string;
    lote_id: string;
    calibre: string;
    color: string;
    calidad: string;
    presentacion_id: string | null;
    cantidad_cajas: number;
    peso_total_kg: number;
    destino: string;
    created_at: string;
    lotes?: {
        numero_lote: string;
        productores?: { nombre: string };
    };
}