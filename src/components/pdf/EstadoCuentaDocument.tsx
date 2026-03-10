import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { COMPANY_INFO } from '@/lib/company';

// Estilos profesionales para el PDF
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 10 },
  logoSection: { width: '40%' },
  companyName: { fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', color: '#166534' }, // Verde Industrial
  companyDetails: { fontSize: 8, color: '#666', marginTop: 4 },

  invoiceDetails: { width: '60%', textAlign: 'right' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  periodo: { fontSize: 10, color: '#555' },

  // Info Productor
  clientBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 4, marginBottom: 20 },
  clientLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
  clientName: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },

  // Tabla Resumen
  summarySection: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, padding: 8, border: '1px solid #e2e8f0', borderRadius: 4 },
  summaryLabel: { fontSize: 8, color: '#64748b' },
  summaryValue: { fontSize: 14, fontWeight: 'bold', marginTop: 4, textAlign: 'right' },

  // Tabla Detallada
  table: { display: "flex", width: "auto", borderStyle: "solid", borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { margin: "auto", flexDirection: "row" },
  tableColHeader: { width: "14%", borderStyle: "solid", borderBottomWidth: 1, borderColor: '#000', backgroundColor: '#f1f5f9', padding: 5 },
  tableColDesc: { width: "30%", borderStyle: "solid", borderBottomWidth: 1, borderColor: '#000', backgroundColor: '#f1f5f9', padding: 5 },
  tableColMoney: { width: "14%", borderStyle: "solid", borderBottomWidth: 1, borderColor: '#000', backgroundColor: '#f1f5f9', padding: 5, textAlign: 'right' },

  tableCell: { width: "14%", borderStyle: "solid", borderBottomWidth: 1, borderColor: '#e2e8f0', padding: 5 },
  tableCellDesc: { width: "30%", borderStyle: "solid", borderBottomWidth: 1, borderColor: '#e2e8f0', padding: 5 },
  tableCellMoney: { width: "14%", borderStyle: "solid", borderBottomWidth: 1, borderColor: '#e2e8f0', padding: 5, textAlign: 'right' },

  // Firmas
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  signBox: { width: '40%', borderTopWidth: 1, borderTopColor: '#000', paddingTop: 10, alignItems: 'center' },
  signText: { fontSize: 8, color: '#666' }
});

// Tipos de datos (Props)
interface Movimiento {
  fecha: string;
  folio: string;
  concepto: string; // "Entrega de Fruta" o "Anticipo Efectivo"
  cargos: number;   // Lo que te debe (Anticipos)
  abonos: number;   // Lo que le debes (Valor Fruta)
  saldo: number;
}

import { Productor } from '@/hooks/useProductores';

interface EstadoCuentaProps {
  productor: Productor;
  periodo: { inicio: string; fin: string };
  movimientos: Movimiento[];
  resumen: { saldoInicial: number; totalAbonos: number; totalCargos: number; saldoFinal: number };
}

// COMPONENTE PDF
export const EstadoCuentaDocument = ({ productor, periodo, movimientos, resumen }: EstadoCuentaProps) => (
  <Document>
    <Page size="LETTER" style={styles.page}>

      {/* 1. HEADER */}
      <View style={styles.header}>
        <View style={styles.logoSection}>
          <Text style={styles.companyName}>{COMPANY_INFO.displayName}</Text>
          <Text style={styles.companyDetails}>{COMPANY_INFO.addressLine1}</Text>
          <Text style={styles.companyDetails}>{COMPANY_INFO.addressLine2}</Text>
          <Text style={styles.companyDetails}>Tel: {COMPANY_INFO.phone}</Text>
        </View>
        <View style={styles.invoiceDetails}>
          <Text style={styles.title}>ESTADO DE CUENTA</Text>
          <Text style={styles.periodo}>Periodo: {periodo.inicio} al {periodo.fin}</Text>
          <Text style={{ fontSize: 9, marginTop: 5, color: '#dc2626' }}>
            Fecha de Emisión: {new Date().toLocaleDateString('es-MX')}
          </Text>
        </View>
      </View>

      {/* 2. DATOS PRODUCTOR */}
      <View style={styles.clientBox}>
        <Text style={styles.clientLabel}>PRODUCTOR / SOCIO</Text>
        <Text style={styles.clientName}>{productor.nombre}</Text>
        <Text style={{ fontSize: 9 }}>ID: {productor.id} | RFC: {productor.rfc || 'XAXX010101000'}</Text>
      </View>

      {/* 3. RESUMEN EJECUTIVO (KPIs) */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>SALDO INICIAL</Text>
          <Text style={styles.summaryValue}>${resumen.saldoInicial.toLocaleString('es-MX')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>(+) VALOR FRUTA</Text>
          <Text style={{ ...styles.summaryValue, color: '#16a34a' }}>${resumen.totalAbonos.toLocaleString('es-MX')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>(-) ANTICIPOS/DED.</Text>
          <Text style={{ ...styles.summaryValue, color: '#dc2626' }}>${resumen.totalCargos.toLocaleString('es-MX')}</Text>
        </View>
        <View style={{ ...styles.summaryCard, backgroundColor: '#f0fdf4', borderColor: '#86efac' }}>
          <Text style={styles.summaryLabel}>= SALDO PENDIENTE</Text>
          <Text style={{ ...styles.summaryValue, color: '#15803d' }}>${resumen.saldoFinal.toLocaleString('es-MX')}</Text>
        </View>
      </View>

      {/* 4. TABLA DETALLADA */}
      <View style={styles.table}>
        {/* Header Tabla */}
        <View style={styles.tableRow}>
          <Text style={styles.tableColHeader}>FECHA</Text>
          <Text style={styles.tableColHeader}>FOLIO</Text>
          <Text style={styles.tableColDesc}>CONCEPTO / DETALLE</Text>
          <Text style={styles.tableColMoney}>CARGOS</Text>
          <Text style={styles.tableColMoney}>ABONOS</Text>
          <Text style={styles.tableColMoney}>SALDO</Text>
        </View>

        {/* Rows */}
        {movimientos.map((mov, i) => (
          <View style={styles.tableRow} key={i}>
            <Text style={styles.tableCell}>{mov.fecha}</Text>
            <Text style={styles.tableCell}>{mov.folio}</Text>
            <Text style={styles.tableCellDesc}>{mov.concepto}</Text>
            <Text style={{ ...styles.tableCellMoney, color: mov.cargos > 0 ? '#dc2626' : '#333' }}>
              {mov.cargos > 0 ? `$${mov.cargos.toLocaleString('es-MX')}` : '-'}
            </Text>
            <Text style={{ ...styles.tableCellMoney, color: mov.abonos > 0 ? '#16a34a' : '#333' }}>
              {mov.abonos > 0 ? `$${mov.abonos.toLocaleString('es-MX')}` : '-'}
            </Text>
            <Text style={{ ...styles.tableCellMoney, color: mov.saldo >= 0 ? '#15803d' : '#dc2626' }}>
              ${mov.saldo.toLocaleString('es-MX')}
            </Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 8, marginTop: 10, color: '#666', fontStyle: 'italic' }}>
        * Este documento es un comprobante interno de liquidación y no sustituye una factura fiscal.
      </Text>

      {/* 5. FIRMAS */}
      <View style={styles.footer}>
        <View style={styles.signBox}>
          <Text style={styles.signText}>AUTORIZADO POR (EMPAQUE)</Text>
          <Text style={{ ...styles.signText, marginTop: 20 }}>Firma y Sello</Text>
        </View>
        <View style={styles.signBox}>
          <Text style={styles.signText}>RECIBÍ DE CONFORMIDAD (PRODUCTOR)</Text>
          <Text style={{ ...styles.signText, marginTop: 20 }}>{productor.nombre}</Text>
        </View>
      </View>

    </Page>
  </Document>
);
