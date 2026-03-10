// src/types/limon.types.ts
export type TipoLimon = 'verde' | 'alimonado' | 'amarillo' | 'economico';
export type Calibre = '45' | 'X' | 'XX' | 'XXX' | 'EXTRA' | 'SUPER';
export type Empaque = 'caja' | 'arpilla';
export type TamanoArpilla = 'grande' | 'mediano' | 'chico';

export interface ProductoLimon {
    id: string;
    nombre: string;
    descripcion: string;
    tipo_limon: TipoLimon;
    calibre: Calibre;
    empaque: Empaque;
    tamano_arpilla?: TamanoArpilla;
    peso_kg: number;
    precio_base: number;
    precio_sugerido: number;
    codigo: string;
    activa: boolean;
}

export interface CartItemLimon {
    id: string;
    nombre: string;
    tipo_limon: TipoLimon;
    calibre: Calibre;
    empaque: Empaque;
    tamano_arpilla?: TamanoArpilla;
    cantidad: number;
    precio_venta: number;
    peso_kg: number;
}