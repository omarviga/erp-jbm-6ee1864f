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
      abono_asignaciones: {
        Row: {
          abono_id: string
          created_at: string
          cxp_id: string
          id: string
          monto_aplicado: number
        }
        Insert: {
          abono_id: string
          created_at?: string
          cxp_id: string
          id?: string
          monto_aplicado: number
        }
        Update: {
          abono_id?: string
          created_at?: string
          cxp_id?: string
          id?: string
          monto_aplicado?: number
        }
        Relationships: [
          {
            foreignKeyName: "abono_asignaciones_abono_id_fkey"
            columns: ["abono_id"]
            isOneToOne: false
            referencedRelation: "abonos_productor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abono_asignaciones_cxp_id_fkey"
            columns: ["cxp_id"]
            isOneToOne: false
            referencedRelation: "cuentas_por_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      abonos_productor: {
        Row: {
          comprobante_url: string | null
          created_at: string
          id: string
          metodo_pago: string
          monto: number
          notas: string | null
          productor_id: string
          referencia: string | null
          usuario_id: string | null
        }
        Insert: {
          comprobante_url?: string | null
          created_at?: string
          id?: string
          metodo_pago: string
          monto: number
          notas?: string | null
          productor_id: string
          referencia?: string | null
          usuario_id?: string | null
        }
        Update: {
          comprobante_url?: string | null
          created_at?: string
          id?: string
          metodo_pago?: string
          monto?: number
          notas?: string | null
          productor_id?: string
          referencia?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abonos_productor_productor_id_fkey"
            columns: ["productor_id"]
            isOneToOne: false
            referencedRelation: "productores"
            referencedColumns: ["id"]
          },
        ]
      }
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
      auditoria_inventario_cdmx: {
        Row: {
          cantidad: number
          cantidad_antes: number
          cantidad_despues: number
          created_at: string
          id: string
          inventario_id: string
          motivo: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          tipo_movimiento: string
          usuario_id: string | null
        }
        Insert: {
          cantidad: number
          cantidad_antes: number
          cantidad_despues: number
          created_at?: string
          id?: string
          inventario_id: string
          motivo?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo_movimiento: string
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          cantidad_antes?: number
          cantidad_despues?: number
          created_at?: string
          id?: string
          inventario_id?: string
          motivo?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo_movimiento?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_inventario_cdmx_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "inventario_bodega_cdmx"
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
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string
          dias_credito?: number | null
          id?: string
          nombre: string
          saldo_deudor?: number | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string
          dias_credito?: number | null
          id?: string
          nombre?: string
          saldo_deudor?: number | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: []
      }
      clientes_maquila: {
        Row: {
          activo: boolean | null
          contacto: string | null
          created_at: string | null
          id: string
          nombre: string
          rfc: string | null
          tarifa_caja: number
          tarifa_kg: number
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          contacto?: string | null
          created_at?: string | null
          id?: string
          nombre: string
          rfc?: string | null
          tarifa_caja?: number
          tarifa_kg?: number
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          contacto?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
          rfc?: string | null
          tarifa_caja?: number
          tarifa_kg?: number
          telefono?: string | null
        }
        Relationships: []
      }
      clientes_sensible: {
        Row: {
          codigo_postal: string | null
          created_at: string
          direccion: string | null
          email: string | null
          forma_pago_default: string | null
          id: string
          limite_credito: number | null
          metodo_pago_default: string | null
          pais: string | null
          razon_social: string | null
          regimen_fiscal: string | null
          rfc: string | null
          telefono: string | null
          updated_at: string
          uso_cfdi_default: string | null
        }
        Insert: {
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          forma_pago_default?: string | null
          id: string
          limite_credito?: number | null
          metodo_pago_default?: string | null
          pais?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          uso_cfdi_default?: string | null
        }
        Update: {
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          forma_pago_default?: string | null
          id?: string
          limite_credito?: number | null
          metodo_pago_default?: string | null
          pais?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          uso_cfdi_default?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sensible_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
      cortes_caja_bodega: {
        Row: {
          cerrado_por: string | null
          created_at: string
          diferencia: number | null
          efectivo_fisico: number | null
          efectivo_teorico: number
          estado: string
          fecha_corte: string
          fecha_fin: string
          fecha_inicio: string
          folio: string
          id: string
          notas: string | null
          total_efectivo: number
          total_tarjeta: number
          total_transferencia: number
          total_ventas: number
          updated_at: string
        }
        Insert: {
          cerrado_por?: string | null
          created_at?: string
          diferencia?: number | null
          efectivo_fisico?: number | null
          efectivo_teorico?: number
          estado?: string
          fecha_corte?: string
          fecha_fin: string
          fecha_inicio: string
          folio: string
          id?: string
          notas?: string | null
          total_efectivo?: number
          total_tarjeta?: number
          total_transferencia?: number
          total_ventas?: number
          updated_at?: string
        }
        Update: {
          cerrado_por?: string | null
          created_at?: string
          diferencia?: number | null
          efectivo_fisico?: number | null
          efectivo_teorico?: number
          estado?: string
          fecha_corte?: string
          fecha_fin?: string
          fecha_inicio?: string
          folio?: string
          id?: string
          notas?: string | null
          total_efectivo?: number
          total_tarjeta?: number
          total_transferencia?: number
          total_ventas?: number
          updated_at?: string
        }
        Relationships: []
      }
      cuentas_por_pagar: {
        Row: {
          created_at: string
          estado: string
          fecha_ticket: string
          id: string
          kilos_netos: number
          kilos_pagables: number
          lote_id: string
          monto_pagado: number
          monto_total: number
          numero_lote: string
          precio_kg: number
          productor_id: string
          saldo_pendiente: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_ticket?: string
          id?: string
          kilos_netos?: number
          kilos_pagables?: number
          lote_id: string
          monto_pagado?: number
          monto_total?: number
          numero_lote: string
          precio_kg?: number
          productor_id: string
          saldo_pendiente?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_ticket?: string
          id?: string
          kilos_netos?: number
          kilos_pagables?: number
          lote_id?: string
          monto_pagado?: number
          monto_total?: number
          numero_lote?: string
          precio_kg?: number
          productor_id?: string
          saldo_pendiente?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_por_pagar_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: true
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuentas_por_pagar_productor_id_fkey"
            columns: ["productor_id"]
            isOneToOne: false
            referencedRelation: "productores"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_detalles: {
        Row: {
          cantidad: number
          clave_producto_sat: string | null
          clave_unidad_sat: string | null
          created_at: string
          descripcion: string
          descuento: number | null
          factura_id: string
          id: string
          ieps_aplicable: number | null
          importe: number | null
          iva_aplicable: boolean | null
          objeto_impuesto: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
          unidad: string
        }
        Insert: {
          cantidad?: number
          clave_producto_sat?: string | null
          clave_unidad_sat?: string | null
          created_at?: string
          descripcion: string
          descuento?: number | null
          factura_id: string
          id?: string
          ieps_aplicable?: number | null
          importe?: number | null
          iva_aplicable?: boolean | null
          objeto_impuesto?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
          unidad?: string
        }
        Update: {
          cantidad?: number
          clave_producto_sat?: string | null
          clave_unidad_sat?: string | null
          created_at?: string
          descripcion?: string
          descuento?: number | null
          factura_id?: string
          id?: string
          ieps_aplicable?: number | null
          importe?: number | null
          iva_aplicable?: boolean | null
          objeto_impuesto?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_detalles_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_eventos: {
        Row: {
          created_at: string
          factura_id: string
          id: string
          payload: Json | null
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          factura_id: string
          id?: string
          payload?: Json | null
          tipo_evento: string
        }
        Update: {
          created_at?: string
          factura_id?: string
          id?: string
          payload?: Json | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_eventos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_timbrado_intentos: {
        Row: {
          created_at: string
          error_message: string | null
          exito: boolean
          factura_id: string
          id: string
          proveedor_pac: string | null
          request_payload: Json | null
          response_payload: Json | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          exito?: boolean
          factura_id: string
          id?: string
          proveedor_pac?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          exito?: boolean
          factura_id?: string
          id?: string
          proveedor_pac?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "factura_timbrado_intentos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      facturacion_config: {
        Row: {
          activo: boolean
          certificado_cer_url: string | null
          certificado_csd_no: string | null
          codigo_postal_expedicion: string | null
          created_at: string
          emisor_nombre: string | null
          emisor_regimen_fiscal: string | null
          emisor_rfc: string | null
          id: string
          llave_privada_key_url: string | null
          llave_privada_passphrase: string | null
          pac_api_url: string | null
          pac_modo: string
          pac_password: string | null
          pac_proveedor: string | null
          pac_usuario: string | null
          serie_facturas: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          certificado_cer_url?: string | null
          certificado_csd_no?: string | null
          codigo_postal_expedicion?: string | null
          created_at?: string
          emisor_nombre?: string | null
          emisor_regimen_fiscal?: string | null
          emisor_rfc?: string | null
          id?: string
          llave_privada_key_url?: string | null
          llave_privada_passphrase?: string | null
          pac_api_url?: string | null
          pac_modo?: string
          pac_password?: string | null
          pac_proveedor?: string | null
          pac_usuario?: string | null
          serie_facturas?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          certificado_cer_url?: string | null
          certificado_csd_no?: string | null
          codigo_postal_expedicion?: string | null
          created_at?: string
          emisor_nombre?: string | null
          emisor_regimen_fiscal?: string | null
          emisor_rfc?: string | null
          id?: string
          llave_privada_key_url?: string | null
          llave_privada_passphrase?: string | null
          pac_api_url?: string | null
          pac_modo?: string
          pac_password?: string | null
          pac_proveedor?: string | null
          pac_usuario?: string | null
          serie_facturas?: string
          updated_at?: string
        }
        Relationships: []
      }
      facturas: {
        Row: {
          cliente_id: string
          created_at: string
          emisor_nombre: string | null
          emisor_regimen_fiscal: string | null
          emisor_rfc: string | null
          estado_timbrado: string
          exportacion: string
          fecha_emision: string
          fecha_timbrado: string | null
          fecha_vencimiento: string | null
          folio: string
          forma_pago: string | null
          id: string
          ieps: number
          iva: number
          lugar_expedicion: string | null
          metodo_pago: string | null
          moneda: string
          notas: string | null
          pac_error: string | null
          pac_proveedor: string | null
          pac_respuesta: Json | null
          pdf_url: string | null
          receptor_codigo_postal: string | null
          receptor_direccion: string | null
          receptor_email: string | null
          receptor_nombre: string | null
          receptor_regimen_fiscal: string | null
          receptor_rfc: string | null
          retenciones: number
          status: string
          subtotal: number
          terminos: string | null
          timbrado_listo: boolean
          tipo_cambio: number | null
          total: number
          ultima_validacion: string | null
          updated_at: string
          uso_cfdi: string | null
          uuid_fiscal: string | null
          venta_origen_id: string | null
          version_cfdi: string
          xml_payload: Json | null
          xml_url: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          emisor_nombre?: string | null
          emisor_regimen_fiscal?: string | null
          emisor_rfc?: string | null
          estado_timbrado?: string
          exportacion?: string
          fecha_emision?: string
          fecha_timbrado?: string | null
          fecha_vencimiento?: string | null
          folio: string
          forma_pago?: string | null
          id?: string
          ieps?: number
          iva?: number
          lugar_expedicion?: string | null
          metodo_pago?: string | null
          moneda?: string
          notas?: string | null
          pac_error?: string | null
          pac_proveedor?: string | null
          pac_respuesta?: Json | null
          pdf_url?: string | null
          receptor_codigo_postal?: string | null
          receptor_direccion?: string | null
          receptor_email?: string | null
          receptor_nombre?: string | null
          receptor_regimen_fiscal?: string | null
          receptor_rfc?: string | null
          retenciones?: number
          status?: string
          subtotal?: number
          terminos?: string | null
          timbrado_listo?: boolean
          tipo_cambio?: number | null
          total?: number
          ultima_validacion?: string | null
          updated_at?: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
          venta_origen_id?: string | null
          version_cfdi?: string
          xml_payload?: Json | null
          xml_url?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          emisor_nombre?: string | null
          emisor_regimen_fiscal?: string | null
          emisor_rfc?: string | null
          estado_timbrado?: string
          exportacion?: string
          fecha_emision?: string
          fecha_timbrado?: string | null
          fecha_vencimiento?: string | null
          folio?: string
          forma_pago?: string | null
          id?: string
          ieps?: number
          iva?: number
          lugar_expedicion?: string | null
          metodo_pago?: string | null
          moneda?: string
          notas?: string | null
          pac_error?: string | null
          pac_proveedor?: string | null
          pac_respuesta?: Json | null
          pdf_url?: string | null
          receptor_codigo_postal?: string | null
          receptor_direccion?: string | null
          receptor_email?: string | null
          receptor_nombre?: string | null
          receptor_regimen_fiscal?: string | null
          receptor_rfc?: string | null
          retenciones?: number
          status?: string
          subtotal?: number
          terminos?: string | null
          timbrado_listo?: boolean
          tipo_cambio?: number | null
          total?: number
          ultima_validacion?: string | null
          updated_at?: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
          venta_origen_id?: string | null
          version_cfdi?: string
          xml_payload?: Json | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_venta_origen_id_fkey"
            columns: ["venta_origen_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      fletes_productor: {
        Row: {
          aplicado: boolean | null
          concepto: string
          created_at: string | null
          fecha: string
          id: string
          liquidacion_id: string | null
          monto: number
          productor_id: string
        }
        Insert: {
          aplicado?: boolean | null
          concepto: string
          created_at?: string | null
          fecha?: string
          id?: string
          liquidacion_id?: string | null
          monto: number
          productor_id: string
        }
        Update: {
          aplicado?: boolean | null
          concepto?: string
          created_at?: string | null
          fecha?: string
          id?: string
          liquidacion_id?: string | null
          monto?: number
          productor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fletes_productor_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fletes_productor_productor_id_fkey"
            columns: ["productor_id"]
            isOneToOne: false
            referencedRelation: "productores"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_gasto"]
          concepto: string
          created_at: string
          fecha: string
          id: string
          imagen_url: string | null
          monto: number
          notas: string | null
          numero_ticket: string | null
          proveedor: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["categoria_gasto"]
          concepto: string
          created_at?: string
          fecha?: string
          id?: string
          imagen_url?: string | null
          monto?: number
          notas?: string | null
          numero_ticket?: string | null
          proveedor?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_gasto"]
          concepto?: string
          created_at?: string
          fecha?: string
          id?: string
          imagen_url?: string | null
          monto?: number
          notas?: string | null
          numero_ticket?: string | null
          proveedor?: string | null
          updated_at?: string
          usuario_id?: string | null
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
          estado: string
          fda_prior_notice: boolean | null
          fecha_salida: string
          finalizada: boolean | null
          folio: string | null
          id: string
          lugar_destino: string | null
          lugar_origen: string | null
          notas: string | null
          numero_guia: string
          peso_total: number | null
          temperatura_precarga: number | null
          total_cajas: number | null
          transportista_id: string | null
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
          estado?: string
          fda_prior_notice?: boolean | null
          fecha_salida?: string
          finalizada?: boolean | null
          folio?: string | null
          id?: string
          lugar_destino?: string | null
          lugar_origen?: string | null
          notas?: string | null
          numero_guia: string
          peso_total?: number | null
          temperatura_precarga?: number | null
          total_cajas?: number | null
          transportista_id?: string | null
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
          estado?: string
          fda_prior_notice?: boolean | null
          fecha_salida?: string
          finalizada?: boolean | null
          folio?: string | null
          id?: string
          lugar_destino?: string | null
          lugar_origen?: string | null
          notas?: string | null
          numero_guia?: string
          peso_total?: number | null
          temperatura_precarga?: number | null
          total_cajas?: number | null
          transportista_id?: string | null
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
          {
            foreignKeyName: "guias_salida_transportista_id_fkey"
            columns: ["transportista_id"]
            isOneToOne: false
            referencedRelation: "transportistas"
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
      inventario_bodega_cdmx: {
        Row: {
          cantidad_disponible: number
          created_at: string
          fecha_ingreso: string
          id: string
          precio_base: number
          precio_venta: number
          presentacion_id: string
          transferencia_id: string | null
          updated_at: string
        }
        Insert: {
          cantidad_disponible?: number
          created_at?: string
          fecha_ingreso?: string
          id?: string
          precio_base: number
          precio_venta: number
          presentacion_id: string
          transferencia_id?: string | null
          updated_at?: string
        }
        Update: {
          cantidad_disponible?: number
          created_at?: string
          fecha_ingreso?: string
          id?: string
          precio_base?: number
          precio_venta?: number
          presentacion_id?: string
          transferencia_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_bodega_cdmx_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_bodega_cdmx_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias_bodega"
            referencedColumns: ["id"]
          },
        ]
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
      liquidacion_pagos: {
        Row: {
          created_at: string | null
          fecha_pago: string | null
          forma_pago: string
          id: string
          liquidacion_id: string
          monto: number
          referencia: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          fecha_pago?: string | null
          forma_pago: string
          id?: string
          liquidacion_id: string
          monto: number
          referencia?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          fecha_pago?: string | null
          forma_pago?: string
          id?: string
          liquidacion_id?: string
          monto?: number
          referencia?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidacion_pagos_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones: {
        Row: {
          autorizado_por: string | null
          created_at: string
          deduccion_anticipo: number | null
          deduccion_corte: number | null
          deduccion_flete: number | null
          estado_liq: Database["public"]["Enums"]["estado_liquidacion"] | null
          fecha_autorizacion: string | null
          fecha_liquidacion: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id: string
          kilos_exportacion: number | null
          kilos_industria: number | null
          kilos_nacional: number | null
          precio_exportacion_aplicado: number | null
          precio_industria_aplicado: number | null
          precio_nacional_aplicado: number | null
          precio_por_kg: number
          productor_id: string
          referencia_pago: string | null
          subtotal: number | null
          total_kilos: number
          total_pagar: number | null
        }
        Insert: {
          autorizado_por?: string | null
          created_at?: string
          deduccion_anticipo?: number | null
          deduccion_corte?: number | null
          deduccion_flete?: number | null
          estado_liq?: Database["public"]["Enums"]["estado_liquidacion"] | null
          fecha_autorizacion?: string | null
          fecha_liquidacion?: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id?: string
          kilos_exportacion?: number | null
          kilos_industria?: number | null
          kilos_nacional?: number | null
          precio_exportacion_aplicado?: number | null
          precio_industria_aplicado?: number | null
          precio_nacional_aplicado?: number | null
          precio_por_kg: number
          productor_id: string
          referencia_pago?: string | null
          subtotal?: number | null
          total_kilos: number
          total_pagar?: number | null
        }
        Update: {
          autorizado_por?: string | null
          created_at?: string
          deduccion_anticipo?: number | null
          deduccion_corte?: number | null
          deduccion_flete?: number | null
          estado_liq?: Database["public"]["Enums"]["estado_liquidacion"] | null
          fecha_autorizacion?: string | null
          fecha_liquidacion?: string
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          kilos_exportacion?: number | null
          kilos_industria?: number | null
          kilos_nacional?: number | null
          precio_exportacion_aplicado?: number | null
          precio_industria_aplicado?: number | null
          precio_nacional_aplicado?: number | null
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
        Row: {
          calidad_defectos: number | null
          cliente_maquila_id: string | null
          costo_bascula: number | null
          created_at: string
          es_cosecha_propia: boolean | null
          es_maquila: boolean | null
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
          cliente_maquila_id?: string | null
          costo_bascula?: number | null
          created_at?: string
          es_cosecha_propia?: boolean | null
          es_maquila?: boolean | null
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
          cliente_maquila_id?: string | null
          costo_bascula?: number | null
          created_at?: string
          es_cosecha_propia?: boolean | null
          es_maquila?: boolean | null
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
            foreignKeyName: "lotes_cliente_maquila_id_fkey"
            columns: ["cliente_maquila_id"]
            isOneToOne: false
            referencedRelation: "clientes_maquila"
            referencedColumns: ["id"]
          },
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
      notificaciones: {
        Row: {
          categoria: Database["public"]["Enums"]["notification_category"]
          created_at: string
          id: string
          leida: boolean
          mensaje: string
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: Database["public"]["Enums"]["notification_type"]
          titulo: string
          user_id: string | null
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          id?: string
          leida?: boolean
          mensaje: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: Database["public"]["Enums"]["notification_type"]
          titulo: string
          user_id?: string | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          id?: string
          leida?: boolean
          mensaje?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: Database["public"]["Enums"]["notification_type"]
          titulo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ordenes_maquila: {
        Row: {
          cajas_empacadas: number | null
          cliente_maquila_id: string
          costo_total: number | null
          created_at: string | null
          facturado: boolean | null
          fecha_fin: string | null
          fecha_inicio: string | null
          folio: string
          id: string
          kilos_procesados: number | null
          kilos_recibidos: number | null
          lote_ids: string[] | null
          status: string | null
        }
        Insert: {
          cajas_empacadas?: number | null
          cliente_maquila_id: string
          costo_total?: number | null
          created_at?: string | null
          facturado?: boolean | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          folio: string
          id?: string
          kilos_procesados?: number | null
          kilos_recibidos?: number | null
          lote_ids?: string[] | null
          status?: string | null
        }
        Update: {
          cajas_empacadas?: number | null
          cliente_maquila_id?: string
          costo_total?: number | null
          created_at?: string | null
          facturado?: boolean | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          folio?: string
          id?: string
          kilos_procesados?: number | null
          kilos_recibidos?: number | null
          lote_ids?: string[] | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_maquila_cliente_maquila_id_fkey"
            columns: ["cliente_maquila_id"]
            isOneToOne: false
            referencedRelation: "clientes_maquila"
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
      precios_calidad: {
        Row: {
          calidad: Database["public"]["Enums"]["calidad_fruta"]
          created_at: string | null
          id: string
          precio_kg: number
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          calidad: Database["public"]["Enums"]["calidad_fruta"]
          created_at?: string | null
          id?: string
          precio_kg: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          calidad?: Database["public"]["Enums"]["calidad_fruta"]
          created_at?: string | null
          id?: string
          precio_kg?: number
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: []
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
      rutas_validas: {
        Row: {
          activa: boolean | null
          created_at: string | null
          descripcion: string | null
          dominio: string
          id: number
          ruta: string
          updated_at: string | null
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          dominio: string
          id?: number
          ruta: string
          updated_at?: string | null
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          dominio?: string
          id?: number
          ruta?: string
          updated_at?: string | null
        }
        Relationships: []
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
      transferencia_detalles: {
        Row: {
          cantidad_enviada: number
          cantidad_recibida: number | null
          created_at: string
          diferencia: number | null
          id: string
          notas_diferencia: string | null
          precio_base: number
          precio_venta: number | null
          presentacion_id: string
          transferencia_id: string
        }
        Insert: {
          cantidad_enviada: number
          cantidad_recibida?: number | null
          created_at?: string
          diferencia?: number | null
          id?: string
          notas_diferencia?: string | null
          precio_base: number
          precio_venta?: number | null
          presentacion_id: string
          transferencia_id: string
        }
        Update: {
          cantidad_enviada?: number
          cantidad_recibida?: number | null
          created_at?: string
          diferencia?: number | null
          id?: string
          notas_diferencia?: string | null
          precio_base?: number
          precio_venta?: number | null
          presentacion_id?: string
          transferencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencia_detalles_presentacion_id_fkey"
            columns: ["presentacion_id"]
            isOneToOne: false
            referencedRelation: "presentaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencia_detalles_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias_bodega"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_bodega: {
        Row: {
          chofer: string | null
          created_at: string
          destino: string
          estado: string
          fecha_recepcion: string | null
          fecha_salida: string
          folio: string
          id: string
          notas_recepcion: string | null
          notas_salida: string | null
          origen: string
          placas: string | null
          recibido_por: string | null
          updated_at: string
        }
        Insert: {
          chofer?: string | null
          created_at?: string
          destino?: string
          estado?: string
          fecha_recepcion?: string | null
          fecha_salida?: string
          folio: string
          id?: string
          notas_recepcion?: string | null
          notas_salida?: string | null
          origen?: string
          placas?: string | null
          recibido_por?: string | null
          updated_at?: string
        }
        Update: {
          chofer?: string | null
          created_at?: string
          destino?: string
          estado?: string
          fecha_recepcion?: string | null
          fecha_salida?: string
          folio?: string
          id?: string
          notas_recepcion?: string | null
          notas_salida?: string | null
          origen?: string
          placas?: string | null
          recibido_por?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transportistas: {
        Row: {
          created_at: string
          id: string
          nombre: string
          numero_permiso: string | null
          placas: string | null
          poliza_seguro: string | null
          rfc: string | null
          seguro_responsabilidad_civil: boolean | null
          telefono: string | null
          tipo_permiso: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          numero_permiso?: string | null
          placas?: string | null
          poliza_seguro?: string | null
          rfc?: string | null
          seguro_responsabilidad_civil?: boolean | null
          telefono?: string | null
          tipo_permiso?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          numero_permiso?: string | null
          placas?: string | null
          poliza_seguro?: string | null
          rfc?: string | null
          seguro_responsabilidad_civil?: boolean | null
          telefono?: string | null
          tipo_permiso?: string | null
          updated_at?: string
        }
        Relationships: []
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
      usuarios: {
        Row: {
          activo: boolean | null
          auth_user_id: string | null
          created_at: string | null
          departamento: string | null
          email: string
          id: string
          nombre: string
          rol: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          departamento?: string | null
          email: string
          id?: string
          nombre: string
          rol?: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          departamento?: string | null
          email?: string
          id?: string
          nombre?: string
          rol?: string
          updated_at?: string | null
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
      venta_detalles_cdmx: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string
          id: string
          inventario_id: string | null
          precio_unitario: number
          subtotal: number | null
          venta_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          descripcion: string
          id?: string
          inventario_id?: string | null
          precio_unitario: number
          subtotal?: number | null
          venta_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string
          id?: string
          inventario_id?: string | null
          precio_unitario?: number
          subtotal?: number | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_detalles_cdmx_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "inventario_bodega_cdmx"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_detalles_cdmx_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas_cdmx"
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
      ventas_cdmx: {
        Row: {
          created_at: string
          created_by: string | null
          fecha_venta: string
          id: string
          metodo_pago: Database["public"]["Enums"]["forma_pago"]
          notas: string | null
          numero_venta: string
          pagado: boolean
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha_venta?: string
          id?: string
          metodo_pago: Database["public"]["Enums"]["forma_pago"]
          notas?: string | null
          numero_venta: string
          pagado?: boolean
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha_venta?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["forma_pago"]
          notas?: string | null
          numero_venta?: string
          pagado?: boolean
          total?: number
        }
        Relationships: []
      }
      ventas_exportacion: {
        Row: {
          ajuste_merma: number | null
          anticipo_pagado: boolean | null
          anticipo_porcentaje: number | null
          confirmacion_llegada: boolean | null
          created_at: string | null
          id: string
          moneda: string | null
          notas_calidad: string | null
          status: string | null
          tc_pago: number | null
          tc_venta: number | null
          venta_id: string
        }
        Insert: {
          ajuste_merma?: number | null
          anticipo_pagado?: boolean | null
          anticipo_porcentaje?: number | null
          confirmacion_llegada?: boolean | null
          created_at?: string | null
          id?: string
          moneda?: string | null
          notas_calidad?: string | null
          status?: string | null
          tc_pago?: number | null
          tc_venta?: number | null
          venta_id: string
        }
        Update: {
          ajuste_merma?: number | null
          anticipo_pagado?: boolean | null
          anticipo_porcentaje?: number | null
          confirmacion_llegada?: boolean | null
          created_at?: string | null
          id?: string
          moneda?: string | null
          notas_calidad?: string | null
          status?: string | null
          tc_pago?: number | null
          tc_venta?: number | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_exportacion_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: true
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_efectivo_teorico_corte: {
        Args: { p_fecha_fin: string; p_fecha_inicio: string }
        Returns: number
      }
      convertir_presentacion_a_granel_cdmx: {
        Args: {
          p_cajas: number
          p_precio_venta_kg?: number
          p_presentacion_id: string
        }
        Returns: {
          kilos_convertidos: number
          mensaje: string
          presentacion_granel_id: string
          success: boolean
        }[]
      }
      crear_factura_borrador_cfdi: {
        Args: {
          p_cliente_id: string
          p_fecha_vencimiento: string
          p_folio?: string
          p_forma_pago: string
          p_items: Json
          p_metodo_pago: string
          p_moneda: string
          p_notas: string
          p_terminos: string
          p_uso_cfdi: string
          p_venta_origen_id?: string
        }
        Returns: {
          estado_timbrado: string
          factura_id: string
          folio: string
          timbrado_listo: boolean
        }[]
      }
      evaluar_factura_para_timbrado: {
        Args: { p_factura_id: string }
        Returns: {
          faltantes: string[]
          lista: boolean
        }[]
      }
      generar_folio_factura: { Args: never; Returns: string }
      generate_lote_number: { Args: never; Returns: string }
      get_resumen_financiero: {
        Args: { fecha_fin: string; fecha_inicio: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      procesar_liquidacion_productor: {
        Args: {
          p_deduccion_anticipo?: number
          p_deduccion_corte?: number
          p_deduccion_flete?: number
          p_forma_pago?: Database["public"]["Enums"]["forma_pago"]
          p_lote_ids: string[]
          p_precio_por_kg: number
          p_productor_id: string
          p_referencia_pago?: string
          p_total_kilos: number
          p_total_pagar?: number
        }
        Returns: {
          liquidacion_id: string
          mensaje: string
          saldo_anticipos: number
          saldo_pendiente: number
          success: boolean
        }[]
      }
      procesar_recepcion_transferencia: {
        Args: {
          p_detalles: Json
          p_recibido_por: string
          p_transferencia_id: string
        }
        Returns: {
          mensaje: string
          success: boolean
          tiene_discrepancias: boolean
        }[]
      }
      procesar_venta_cdmx:
        | {
            Args: {
              p_items: Json
              p_metodo_pago: string
              p_monto_total: number
            }
            Returns: {
              mensaje: string
              success: boolean
              venta_id: string
            }[]
          }
        | {
            Args: {
              p_cliente_id: string
              p_items: Json
              p_metodo_pago: string
              p_monto_total: number
            }
            Returns: {
              mensaje: string
              success: boolean
              venta_id: string
            }[]
          }
      process_sale_with_inventory: {
        Args: {
          p_cliente_id: string
          p_items: Json
          p_metodo_pago: string
          p_monto_total: number
        }
        Returns: string
      }
      registrar_adelanto_productor: {
        Args: {
          p_forma_pago: Database["public"]["Enums"]["forma_pago"]
          p_monto: number
          p_productor_id: string
          p_referencia?: string
        }
        Returns: {
          adelanto_id: string
          mensaje: string
          saldo_anticipos: number
          success: boolean
        }[]
      }
      registrar_merma_granel_cdmx: {
        Args: { p_kilos: number; p_motivo: string; p_presentacion_id: string }
        Returns: {
          kilos_mermados: number
          mensaje: string
          success: boolean
        }[]
      }
      registrar_resultado_timbrado_factura: {
        Args: {
          p_error_message?: string
          p_exito: boolean
          p_factura_id: string
          p_pdf_url?: string
          p_proveedor_pac: string
          p_request_payload?: Json
          p_response_payload?: Json
          p_uuid_fiscal?: string
          p_xml_url?: string
        }
        Returns: {
          cliente_id: string
          created_at: string
          emisor_nombre: string | null
          emisor_regimen_fiscal: string | null
          emisor_rfc: string | null
          estado_timbrado: string
          exportacion: string
          fecha_emision: string
          fecha_timbrado: string | null
          fecha_vencimiento: string | null
          folio: string
          forma_pago: string | null
          id: string
          ieps: number
          iva: number
          lugar_expedicion: string | null
          metodo_pago: string | null
          moneda: string
          notas: string | null
          pac_error: string | null
          pac_proveedor: string | null
          pac_respuesta: Json | null
          pdf_url: string | null
          receptor_codigo_postal: string | null
          receptor_direccion: string | null
          receptor_email: string | null
          receptor_nombre: string | null
          receptor_regimen_fiscal: string | null
          receptor_rfc: string | null
          retenciones: number
          status: string
          subtotal: number
          terminos: string | null
          timbrado_listo: boolean
          tipo_cambio: number | null
          total: number
          ultima_validacion: string | null
          updated_at: string
          uso_cfdi: string | null
          uuid_fiscal: string | null
          venta_origen_id: string | null
          version_cfdi: string
          xml_payload: Json | null
          xml_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "facturas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validar_ruta: {
        Args: { p_dominio: string; p_ruta: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "produccion" | "finanzas" | "ventas" | "almacen"
      calibre_limon:
        | "V-4"
        | "V-5"
        | "V-X"
        | "V-XX"
        | "V-XXX"
        | "V-EXT"
        | "AL-4"
        | "AL-5"
        | "AL-X"
        | "AL-XX"
        | "AL-XXX"
        | "AL-EXT"
        | "AM-X"
        | "AM-XX"
        | "AM-XXX"
        | "AM-EXT"
      calidad_fruta: "exportacion" | "nacional" | "industria" | "desecho"
      calidad_limon: "primera" | "segunda" | "industria"
      categoria_gasto:
        | "mantenimiento"
        | "viaticos"
        | "combustible"
        | "papeleria"
        | "limpieza"
        | "refacciones"
        | "servicios"
        | "otros"
      color_limon: "verde" | "alimonado" | "amarillo"
      destino_produccion:
        | "piso_empaque"
        | "camara_fria"
        | "molino"
        | "transporte_directo"
      estado_liquidacion: "BORRADOR" | "AUTORIZADA" | "PAGADA"
      estado_lote: "pendiente" | "en_proceso" | "liquidado"
      forma_pago: "efectivo" | "cheque" | "transferencia"
      notification_category:
        | "inventario"
        | "transferencia"
        | "venta"
        | "corte_caja"
        | "produccion"
        | "sistema"
      notification_type: "info" | "warning" | "success" | "error" | "alert"
      tipo_cliente: "nacional" | "mayorista" | "exportacion_usa"
      tipo_insumo:
        | "caja_plastica"
        | "arpilla"
        | "tarima"
        | "esquinero"
        | "fleje"
        | "cera"
        | "caja_carton"
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
      calibre_limon: [
        "V-4",
        "V-5",
        "V-X",
        "V-XX",
        "V-XXX",
        "V-EXT",
        "AL-4",
        "AL-5",
        "AL-X",
        "AL-XX",
        "AL-XXX",
        "AL-EXT",
        "AM-X",
        "AM-XX",
        "AM-XXX",
        "AM-EXT",
      ],
      calidad_fruta: ["exportacion", "nacional", "industria", "desecho"],
      calidad_limon: ["primera", "segunda", "industria"],
      categoria_gasto: [
        "mantenimiento",
        "viaticos",
        "combustible",
        "papeleria",
        "limpieza",
        "refacciones",
        "servicios",
        "otros",
      ],
      color_limon: ["verde", "alimonado", "amarillo"],
      destino_produccion: [
        "piso_empaque",
        "camara_fria",
        "molino",
        "transporte_directo",
      ],
      estado_liquidacion: ["BORRADOR", "AUTORIZADA", "PAGADA"],
      estado_lote: ["pendiente", "en_proceso", "liquidado"],
      forma_pago: ["efectivo", "cheque", "transferencia"],
      notification_category: [
        "inventario",
        "transferencia",
        "venta",
        "corte_caja",
        "produccion",
        "sistema",
      ],
      notification_type: ["info", "warning", "success", "error", "alert"],
      tipo_cliente: ["nacional", "mayorista", "exportacion_usa"],
      tipo_insumo: [
        "caja_plastica",
        "arpilla",
        "tarima",
        "esquinero",
        "fleje",
        "cera",
        "caja_carton",
      ],
    },
  },
} as const
