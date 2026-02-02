export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      anticipos: {
        Row: {
          amortizado: boolean | null
          created_at: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id: string
          monto: number
          productor_id: string
          referencia: string | null
        }
        Insert: {
          amortizado?: boolean | null
          created_at?: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto: number
          productor_id: string
          referencia?: string | null
        }
        Update: {
          amortizado?: boolean | null
          created_at?: string
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto?: number
          productor_id?: string
          referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anticipos_productor_id_fkey"
            columns: ["productor_id"]
            isOneToOne: false
            referencedRelation: "productores"
            referencedColumns: ["id"]
          },
        ]
      }
      camara_fria: {
        Row: {
          cantidad_cajas: number
          cantidad_disponible: number
          created_at: string
          fecha_ingreso: string
          id: string
          produccion_id: string
          temperatura_actual: number | null
          updated_at: string
        }
        Insert: {
          cantidad_cajas: number
          cantidad_disponible: number
          created_at?: string
          fecha_ingreso?: string
          id?: string
          produccion_id: string
          temperatura_actual?: number | null
          updated_at?: string
        }
        Update: {
          cantidad_cajas?: number
          cantidad_disponible?: number
          created_at?: string
          fecha_ingreso?: string
          id?: string
          produccion_id?: string
          temperatura_actual?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camara_fria_produccion_id_fkey"
            columns: ["produccion_id"]
            isOneToOne: false
            referencedRelation: "produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          dias_credito: number | null
          id: string
          nombre: string
          saldo_deudor: number | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_credito?: number | null
          id?: string
          nombre: string
          saldo_deudor?: number | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_credito?: number | null
          id?: string
          nombre?: string
          saldo_deudor?: number | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Relationships: []
      }
      clientes_sensible: {
        Row: {
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          limite_credito: number | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          id: string
          limite_credito?: number | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          limite_credito?: number | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sensible_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
        ]
      }
      cortadores: {
        Row: {
          activo: boolean | null
          created_at: string
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      guia_detalles: {
        Row: {
          camara_fria_id: string | null
          cantidad: number
          created_at: string
          guia_id: string
          id: string
          precio_unitario: number
          stock_molino_id: string | null
          subtotal: number | null
        }
        Insert: {
          camara_fria_id?: string | null
          cantidad: number
          created_at?: string
          guia_id: string
          id?: string
          precio_unitario: number
          stock_molino_id?: string | null
          subtotal?: number | null
        }
        Update: {
          camara_fria_id?: string | null
          cantidad?: number
          created_at?: string
          guia_id?: string
          id?: string
          precio_unitario?: number
          stock_molino_id?: string | null
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guia_detalles_camara_fria_id_fkey"
            columns: ["camara_fria_id"]
            isOneToOne: false
            referencedRelation: "camara_fria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guia_detalles_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "guias_salida"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guia_detalles_stock_molino_id_fkey"
            columns: ["stock_molino_id"]
            isOneToOne: false
            referencedRelation: "stock_molino"
            referencedColumns: ["id"]
          },
        ]
      }
      guias_salida: {
        Row: {
          carta_porte: boolean | null
          certificado_fitosanitario: boolean | null
          cliente_id: string
          created_at: string
          destino: string | null
          documentacion_completa: boolean | null
          fda_prior_notice: boolean | null
          fecha_salida: string
          finalizada: boolean | null
          id: string
          notas: string | null
          numero_guia: string
          temperatura_precarga: number | null
          total_cajas: number | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          carta_porte?: boolean | null
          certificado_fitosanitario?: boolean | null
          cliente_id: string
          created_at?: string
          destino?: string | null
          documentacion_completa?: boolean | null
          fda_prior_notice?: boolean | null
          fecha_salida?: string
          finalizada?: boolean | null
          id?: string
          notas?: string | null
          numero_guia: string
          temperatura_precarga?: number | null
          total_cajas?: number | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          carta_porte?: boolean | null
          certificado_fitosanitario?: boolean | null
          cliente_id?: string
          created_at?: string
          destino?: string | null
          documentacion_completa?: boolean | null
          fda_prior_notice?: boolean | null
          fecha_salida?: string
          finalizada?: boolean | null
          id?: string
          notas?: string | null
          numero_guia?: string
          temperatura_precarga?: number | null
          total_cajas?: number | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guias_salida_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      huertos: {
        Row: {
          created_at: string
          hectareas: number | null
          id: string
          nombre: string
          ubicacion: string | null
        }
        Insert: {
          created_at?: string
          hectareas?: number | null
          id?: string
          nombre: string
          ubicacion?: string | null
        }
        Update: {
          created_at?: string
          hectareas?: number | null
          id?: string
          nombre?: string
          ubicacion?: string | null
        }
        Relationships: []
      }
      insumo_movimientos: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          insumo_id: string
          referencia: string | null
          tipo_movimiento: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          insumo_id: string
          referencia?: string | null
          tipo_movimiento: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          insumo_id?: string
          referencia?: string | null
          tipo_movimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_movimientos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          cantidad_disponible: number
          cantidad_minima: number
          costo_unitario: number | null
          created_at: string
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_insumo"]
          updated_at: string
        }
        Insert: {
          cantidad_disponible?: number
          cantidad_minima?: number
          costo_unitario?: number | null
          created_at?: string
          id?: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_insumo"]
          updated_at?: string
        }
        Update: {
          cantidad_disponible?: number
          cantidad_minima?: number
          costo_unitario?: number | null
          created_at?: string
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_insumo"]
          updated_at?: string
        }
        Relationships: []
      }
      liquidacion_lotes: {
        Row: {
          created_at: string
          id: string
          liquidacion_id: string
          lote_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liquidacion_id: string
          lote_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liquidacion_id?: string
          lote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidacion_lotes_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidacion_lotes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones: {
        Row: {
          created_at: string
          deduccion_anticipo: number | null
          deduccion_corte: number | null
          deduccion_flete: number | null
          fecha_liquidacion: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id: string
          precio_por_kg: number
          productor_id: string
          referencia_pago: string | null
          subtotal: number | null
          total_kilos: number
          total_pagar: number | null
        }
        Insert: {
          created_at?: string
          deduccion_anticipo?: number | null
          deduccion_corte?: number | null
          deduccion_flete?: number | null
          fecha_liquidacion?: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id?: string
          precio_por_kg: number
          productor_id: string
          referencia_pago?: string | null
          subtotal?: number | null
          total_kilos: number
          total_pagar?: number | null
        }
        Update: {
          created_at?: string
          deduccion_anticipo?: number | null
          deduccion_corte?: number | null
          deduccion_flete?: number | null
          fecha_liquidacion?: string
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          precio_por_kg?: number
          productor_id?: string
          referencia_pago?: string | null
          subtotal?: number | null
          total_kilos?: number
          total_pagar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_productor_id_fkey"
            columns: ["productor_id"]
            isOneToOne: false
            referencedRelation: "productores"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_cortadores: {
        Row: {
          cajas_recolectadas: number
          cortador_id: string
          created_at: string
          id: string
          lote_id: string
        }
        Insert: {
          cajas_recolectadas?: number
          cortador_id: string
          created_at?: string
          id?: string
          lote_id: string
        }
        Update: {
          cajas_recolectadas?: number
          cortador_id?: string
          created_at?: string
          id?: string
          lote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lote_cortadores_cortador_id_fkey"
            columns: ["cortador_id"]
            isOneToOne: false
            referencedRelation: "cortadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_cortadores_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        calidad_defectos: number | null
        costo_bascula: number | null
        created_at: string
        es_cosecha_propia: boolean | null
        estado: Database["public"]["Enums"]["estado_lote"]
        estado_calidad: string | null
        fecha_recepcion: string
        folio_fisico: string | null
        huerto_id: string | null
        id: string
        kilos_merma: number | null
        notas: string | null
        numero_lote: string
        origen: string | null
        peso_bruto: number
        peso_neto: number | null
        peso_pagable: number | null
        peso_tara: number
        precio_pactado_kg: number | null
        productor_id: string | null
        updated_at: string
        usuario_id: string | null
        zona_asignada: string | null
      }
      Insert: {
        calidad_defectos?: number | null
        costo_bascula?: number | null
        created_at?: string
        es_cosecha_propia?: boolean | null
        estado?: Database["public"]["Enums"]["estado_lote"]
        estado_calidad?: string | null
        fecha_recepcion?: string
        folio_fisico?: string | null
        huerto_id?: string | null
        id?: string
        kilos_merma?: number | null
        notas?: string | null
        numero_lote: string
        origen?: string | null
        peso_bruto: number
        peso_neto?: number | null
        peso_pagable?: number | null
        peso_tara?: number
        precio_pactado_kg?: number | null
        productor_id?: string | null
        updated_at?: string
        usuario_id?: string | null
        zona_asignada?: string | null
      }
      Update: {
        calidad_defectos?: number | null
        costo_bascula?: number | null
        created_at?: string
        es_cosecha_propia?: boolean | null
        estado?: Database["public"]["Enums"]["estado_lote"]
        estado_calidad?: string | null
        fecha_recepcion?: string
        folio_fisico?: string | null
        huerto_id?: string | null
        id?: string
        kilos_merma?: number | null
        notas?: string | null
        numero_lote?: string
        origen?: string | null
        peso_bruto?: number
        peso_neto?: number | null
        peso_pagable?: number | null
        peso_tara?: number
        precio_pactado_kg?: number | null
        productor_id?: string | null
        updated_at?: string
        usuario_id?: string | null
        zona_asignada?: string | null
      }
      Relationships: [
        {
          foreignKeyName: "lotes_huerto_id_fkey"
          columns: ["huerto_id"]
          isOneToOne: false
          referencedRelation: "huertos"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "lotes_productor_id_fkey"
          columns: ["productor_id"]
          isOneToOne: false
          referencedRelation: "productores"
          referencedColumns: ["id"]
        },
      ]
    }
    pagos_clientes: {
      Row: {
        cliente_id: string
        created_at: string
        forma_pago: Database["public"]["Enums"]["forma_pago"]
        id: string
        monto: number
        referencia: string | null
        venta_id: string | null
      }
      Insert: {
        cliente_id: string
        created_at?: string
        forma_pago: Database["public"]["Enums"]["forma_pago"]
        id?: string
        monto: number
        referencia?: string | null
        venta_id?: string | null
      }
      Update: {
        cliente_id?: string
        created_at?: string
        forma_pago?: Database["public"]["Enums"]["forma_pago"]
        id?: string
        monto?: number
        referencia?: string | null
        venta_id?: string | null
      }
      Relationships: [
        {
          foreignKeyName: "pagos_clientes_cliente_id_fkey"
          columns: ["cliente_id"]
          isOneToOne: false
          referencedRelation: "clientes"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "pagos_clientes_venta_id_fkey"
          columns: ["venta_id"]
          isOneToOne: false
          referencedRelation: "ventas"
          referencedColumns: ["id"]
        },
      ]
    }
    presentaciones: {
      Row: {
        activa: boolean | null
        created_at: string
        id: string
        nombre: string
        peso_kg: number
        tipo: string
      }
      Insert: {
        activa?: boolean | null
        created_at?: string
        id?: string
        nombre: string
        peso_kg: number
        tipo: string
      }
      Update: {
        activa?: boolean | null
        created_at?: string
        id?: string
        nombre?: string
        peso_kg?: number
        tipo?: string
      }
      Relationships: []
    }
    produccion: {
      Row: {
        calibre: Database["public"]["Enums"]["calibre_limon"]
        calidad: Database["public"]["Enums"]["calidad_limon"]
        cantidad_cajas: number
        color: Database["public"]["Enums"]["color_limon"]
        created_at: string
        destino: Database["public"]["Enums"]["destino_produccion"]
        id: string
        lote_id: string
        peso_total_kg: number | null
        presentacion_id: string | null
      }
      Insert: {
        calibre: Database["public"]["Enums"]["calibre_limon"]
        calidad: Database["public"]["Enums"]["calidad_limon"]
        cantidad_cajas?: number
        color: Database["public"]["Enums"]["color_limon"]
        created_at?: string
        destino: Database["public"]["Enums"]["destino_produccion"]
        id?: string
        lote_id: string
        peso_total_kg?: number | null
        presentacion_id?: string | null
      }
      Update: {
        calibre?: Database["public"]["Enums"]["calibre_limon"]
        calidad?: Database["public"]["Enums"]["calidad_limon"]
        cantidad_cajas?: number
        color?: Database["public"]["Enums"]["color_limon"]
        created_at?: string
        destino?: Database["public"]["Enums"]["destino_produccion"]
        id?: string
        lote_id?: string
        peso_total_kg?: number | null
        presentacion_id?: string | null
      }
      Relationships: [
        {
          foreignKeyName: "produccion_lote_id_fkey"
          columns: ["lote_id"]
          isOneToOne: false
          referencedRelation: "lotes"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "produccion_presentacion_id_fkey"
          columns: ["presentacion_id"]
          isOneToOne: false
          referencedRelation: "presentaciones"
          referencedColumns: ["id"]
        },
      ]
    }
    productores: {
      Row: {
        created_at: string
        id: string
        nombre: string
        rfc: string | null
        saldo_anticipos: number | null
        saldo_pendiente: number | null
        telefono: string | null
        updated_at: string
      }
      Insert: {
        created_at?: string
        id?: string
        nombre: string
        rfc?: string | null
        saldo_anticipos?: number | null
        saldo_pendiente?: number | null
        telefono?: string | null
        updated_at?: string
      }
      Update: {
        created_at?: string
        id?: string
        nombre?: string
        rfc?: string | null
        saldo_anticipos?: number | null
        saldo_pendiente?: number | null
        telefono?: string | null
        updated_at?: string
      }
      Relationships: []
    }
    registro_temperaturas: {
      Row: {
        camara_fria_id: string
        created_at: string
        id: string
        registrado_por: string | null
        temperatura: number
      }
      Insert: {
        camara_fria_id: string
        created_at?: string
        id?: string
        registrado_por?: string | null
        temperatura: number
      }
      Update: {
        camara_fria_id?: string
        created_at?: string
        id?: string
        registrado_por?: string | null
        temperatura?: number
      }
      Relationships: [
        {
          foreignKeyName: "registro_temperaturas_camara_fria_id_fkey"
          columns: ["camara_fria_id"]
          isOneToOne: false
          referencedRelation: "camara_fria"
          referencedColumns: ["id"]
        },
      ]
    }
    stock_molino: {
      Row: {
        created_at: string
        fecha_ingreso: string
        id: string
        lote_id: string
        peso_disponible: number
        peso_kg: number
      }
      Insert: {
        created_at?: string
        fecha_ingreso?: string
        id?: string
        lote_id: string
        peso_disponible: number
        peso_kg: number
      }
      Update: {
        created_at?: string
        fecha_ingreso?: string
        id?: string
        lote_id?: string
        peso_disponible?: number
        peso_kg?: number
      }
      Relationships: [
        {
          foreignKeyName: "stock_molino_lote_id_fkey"
          columns: ["lote_id"]
          isOneToOne: false
          referencedRelation: "lotes"
          referencedColumns: ["id"]
        },
      ]
    }
    user_roles: {
      Row: {
        created_at: string
        id: string
        role: Database["public"]["Enums"]["app_role"]
        user_id: string
      }
      Insert: {
        created_at?: string
        id?: string
        role: Database["public"]["Enums"]["app_role"]
        user_id: string
      }
      Update: {
        created_at?: string
        id?: string
        role?: Database["public"]["Enums"]["app_role"]
        user_id?: string
      }
      Relationships: []
    }
    venta_detalles: {
      Row: {
        cantidad: number
        created_at: string
        descripcion: string
        id: string
        precio_unitario: number
        subtotal: number | null
        venta_id: string
      }
      Insert: {
        cantidad: number
        created_at?: string
        descripcion: string
        id?: string
        precio_unitario: number
        subtotal?: number | null
        venta_id: string
      }
      Update: {
        cantidad?: number
        created_at?: string
        descripcion?: string
        id?: string
        precio_unitario?: number
        subtotal?: number | null
        venta_id?: string
      }
      Relationships: [
        {
          foreignKeyName: "venta_detalles_venta_id_fkey"
          columns: ["venta_id"]
          isOneToOne: false
          referencedRelation: "ventas"
          referencedColumns: ["id"]
        },
      ]
    }
    ventas: {
      Row: {
        cliente_id: string | null
        created_at: string
        fecha_venta: string
        id: string
        notas: string | null
        numero_venta: string
        pagado: boolean | null
        tipo: string
        total: number
      }
      Insert: {
        cliente_id?: string | null
        created_at?: string
        fecha_venta?: string
        id?: string
        notas?: string | null
        numero_venta: string
        pagado?: boolean | null
        tipo: string
        total?: number
      }
      Update: {
        cliente_id?: string | null
        created_at?: string
        fecha_venta?: string
        id?: string
        notas?: string | null
        numero_venta?: string
        pagado?: boolean | null
        tipo?: string
        total?: number
      }
      Relationships: [
        {
          foreignKeyName: "ventas_cliente_id_fkey"
          columns: ["cliente_id"]
          isOneToOne: false
          referencedRelation: "clientes"
          referencedColumns: ["id"]
        },
      ]
    }
  }
  Views: {
    [_ in never]: never
  }
  Functions: {
    generate_lote_number: { Args: never; Returns: string }
    has_role: {
      Args: {
        _role: Database["public"]["Enums"]["app_role"]
        _user_id: string
      }
      Returns: boolean
    }
  }
  Enums: {
    app_role: "admin" | "produccion" | "finanzas" | "ventas" | "almacen"
    calibre_limon: "200" | "300" | "400" | "500" | "600" | "extras"
    calidad_limon: "primera" | "segunda" | "industria"
    color_limon: "verde_oscuro" | "verde" | "alimonado" | "amarillo"
    destino_produccion: "piso_empaque" | "camara_fria" | "molino"
    estado_lote: "pendiente" | "en_proceso" | "liquidado"
    forma_pago: "efectivo" | "cheque" | "transferencia"
    tipo_cliente: "nacional" | "mayorista" | "exportacion_usa"
    tipo_insumo:
    | "caja_plastica"
    | "arpilla"
    | "tarima"
    | "esquinero"
    | "fleje"
  }
  CompositeTypes: {
    [_ in never]: never
  }
}
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "produccion", "finanzas", "ventas", "almacen"],
      calibre_limon: ["200", "300", "400", "500", "600", "extras"],
      calidad_limon: ["primera", "segunda", "industria"],
      color_limon: ["verde_oscuro", "verde", "alimonado", "amarillo"],
      destino_produccion: ["piso_empaque", "camara_fria", "molino"],
      estado_lote: ["pendiente", "en_proceso", "liquidado"],
      forma_pago: ["efectivo", "cheque", "transferencia"],
      tipo_cliente: ["nacional", "mayorista", "exportacion_usa"],
      tipo_insumo: ["caja_plastica", "arpilla", "tarima", "esquinero", "fleje"],
    },
  },
} as const
