export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      productores: {
        Row: {
          id: string
          nombre: string
          telefono: string | null
          rfc: string | null
          saldo_anticipos: number | null
          saldo_pendiente: number | null
          regimen_fiscal: string | null
          cp_fiscal: string | null
          correo_facturacion: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          telefono?: string | null
          // ... resto de campos opcionales
        }
        Update: {
          id?: string
          nombre?: string
          // ... resto de campos opcionales
        }
      }
      clientes: {
        Row: {
          id: string
          nombre: string
          tipo: 'nacional' | 'exportacion' | string // Asumiendo tu enum
          telefono: string | null
          email: string | null
          direccion: string | null
          saldo_deudor: number
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          tipo?: string
          telefono?: string | null
          // ...
        }
        Update: Partial<Database['public']['Tables']['clientes']['Insert']>
      }
      // Usaremos cat_clasificaciones como tu catálogo de productos base
      cat_clasificaciones: {
        Row: {
          id: number
          nombre_producto: string
          calibre: string
          codigo_interno: string | null
          nombre_completo: string | null
          created_at: string
        }
      }
      ventas: {
        Row: {
          id: string
          numero_venta: string
          cliente_id: string | null
          fecha_venta: string
          tipo: string
          total: number
          pagado: boolean | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          numero_venta: string
          cliente_id?: string | null
          fecha_venta?: string
          tipo: string
          total: number
          pagado?: boolean | null
          notas?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['ventas']['Insert']>
      }
      venta_detalles: {
        Row: {
          id: string
          venta_id: string
          descripcion: string
          cantidad: number
          precio_unitario: number
          subtotal: number | null
          created_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          descripcion: string
          cantidad: number
          precio_unitario: number
          subtotal?: number | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['venta_detalles']['Insert']>
      }
    }
  }
}