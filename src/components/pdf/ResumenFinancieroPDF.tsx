import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_ADDRESS, COMPANY_INFO } from '@/lib/company';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b', backgroundColor: '#ffffff' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: '#16a34a' },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#166534', textTransform: 'uppercase' },
  companySubtitle: { fontSize: 9, color: '#64748b', marginTop: 3 },
  reportTitle: { textAlign: 'right' },
  reportTitleText: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  reportPeriod: { fontSize: 9, color: '#64748b', marginTop: 4 },
  reportDate: { fontSize: 9, color: '#dc2626', marginTop: 2 },

  // KPI Cards
  kpiSection: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpiCard: { flex: 1, padding: 10, borderRadius: 4, border: '1px solid #e2e8f0' },
  kpiCardGreen: { flex: 1, padding: 10, borderRadius: 4, border: '1px solid #86efac', backgroundColor: '#f0fdf4' },
  kpiCardRed: { flex: 1, padding: 10, borderRadius: 4, border: '1px solid #fca5a5', backgroundColor: '#fef2f2' },
  kpiCardOrange: { flex: 1, padding: 10, borderRadius: 4, border: '1px solid #fed7aa', backgroundColor: '#fff7ed' },
  kpiLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  kpiValueGreen: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4, color: '#16a34a' },
  kpiValueRed: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4, color: '#dc2626' },
  kpiValueOrange: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4, color: '#ea580c' },

  // Section title
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 8, marginTop: 16, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },

  // Table
  table: { width: '100%' },
  tableRow: { flexDirection: 'row' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f1f5f9' },
  thDate: { width: '12%', padding: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  thConcepto: { width: '38%', padding: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  thCategoria: { width: '18%', padding: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  thProveedor: { width: '18%', padding: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  thMonto: { width: '14%', padding: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', textAlign: 'right' },

  tdDate: { width: '12%', padding: 6, fontSize: 8, color: '#374151', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tdConcepto: { width: '38%', padding: 6, fontSize: 8, color: '#374151', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tdCategoria: { width: '18%', padding: 6, fontSize: 8, color: '#6b7280', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tdProveedor: { width: '18%', padding: 6, fontSize: 8, color: '#6b7280', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tdMonto: { width: '14%', padding: 6, fontSize: 8, color: '#374151', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', textAlign: 'right', fontFamily: 'Helvetica-Bold' },

  // Category breakdown
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  catLabel: { fontSize: 9, color: '#374151' },
  catValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },

  // Summary totals row
  totalRow: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 8, borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 4 },
  totalLabel: { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  totalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b', textAlign: 'right' },

  // Income/expenses bar (visual summary)
  barContainer: { marginBottom: 16 },
  barLabel: { fontSize: 8, color: '#64748b', marginBottom: 3 },
  barBg: { width: '100%', height: 12, backgroundColor: '#f1f5f9', borderRadius: 4 },
  barFill: { height: 12, borderRadius: 4 },

  // Footer
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#94a3b8' },
  disclaimer: { fontSize: 7, color: '#94a3b8', marginTop: 20, textAlign: 'center', fontStyle: 'italic' },
});

const CATEGORIAS_LABEL: Record<string, string> = {
  mantenimiento: "Mantenimiento",
  viaticos: "Viáticos",
  combustible: "Combustible",
  papeleria: "Papelería",
  limpieza: "Limpieza",
  refacciones: "Refacciones",
  servicios: "Servicios",
  otros: "Otros",
};

interface GastoRow {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  proveedor?: string | null;
  monto: number;
}

interface ResumenFinancieroProps {
  periodo: string;
  totalIngresos: number;
  totalLiquidaciones: number;
  totalGastos: number;
  utilidadBruta: number;
  gastosPorCategoria: { name: string; value: number }[];
  gastosFiltrados: GastoRow[];
}

export const ResumenFinancieroPDF = ({
  periodo,
  totalIngresos,
  totalLiquidaciones,
  totalGastos,
  utilidadBruta,
  gastosPorCategoria,
  gastosFiltrados,
}: ResumenFinancieroProps) => {
  const totalEgresos = totalLiquidaciones + totalGastos;
  const maxBar = Math.max(totalIngresos, totalEgresos, 1);
  const ingresosWidth = Math.round((totalIngresos / maxBar) * 100);
  const egresosWidth = Math.round((totalEgresos / maxBar) * 100);

  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{COMPANY_INFO.displayName}</Text>
            <Text style={styles.companySubtitle}>{COMPANY_ADDRESS}</Text>
          </View>
          <View style={styles.reportTitle}>
            <Text style={styles.reportTitleText}>RESUMEN FINANCIERO</Text>
            <Text style={styles.reportPeriod}>Periodo: {periodo}</Text>
            <Text style={styles.reportDate}>Generado: {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* KPI CARDS */}
        <View style={styles.kpiSection}>
          <View style={styles.kpiCardGreen}>
            <Text style={styles.kpiLabel}>Ingresos</Text>
            <Text style={styles.kpiValueGreen}>{fmt(totalIngresos)}</Text>
          </View>
          <View style={styles.kpiCardOrange}>
            <Text style={styles.kpiLabel}>Pago Productores</Text>
            <Text style={styles.kpiValueOrange}>{fmt(totalLiquidaciones)}</Text>
          </View>
          <View style={styles.kpiCardRed}>
            <Text style={styles.kpiLabel}>Gastos Operativos</Text>
            <Text style={styles.kpiValueRed}>{fmt(totalGastos)}</Text>
          </View>
          <View style={utilidadBruta >= 0 ? styles.kpiCardGreen : styles.kpiCardRed}>
            <Text style={styles.kpiLabel}>Utilidad Bruta</Text>
            <Text style={utilidadBruta >= 0 ? styles.kpiValueGreen : styles.kpiValueRed}>{fmt(utilidadBruta)}</Text>
          </View>
        </View>

        {/* VISUAL BAR SUMMARY */}
        <Text style={styles.sectionTitle}>Flujo de Caja — Ingresos vs Egresos</Text>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>Ingresos: {fmt(totalIngresos)}</Text>
          <View style={styles.barBg}>
            <View style={{ ...styles.barFill, width: `${ingresosWidth}%`, backgroundColor: '#16a34a' }} />
          </View>
        </View>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>Egresos Totales: {fmt(totalEgresos)}</Text>
          <View style={styles.barBg}>
            <View style={{ ...styles.barFill, width: `${egresosWidth}%`, backgroundColor: '#ef4444' }} />
          </View>
        </View>

        {/* DESGLOSE EGRESOS */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 4 }}>
          <View style={{ flex: 1, padding: 8, border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <Text style={styles.sectionTitle}>Desglose de Egresos</Text>
            <View style={styles.catRow}>
              <Text style={styles.catLabel}>Pago a Productores</Text>
              <Text style={styles.catValue}>{fmt(totalLiquidaciones)}</Text>
            </View>
            <View style={styles.catRow}>
              <Text style={styles.catLabel}>Gastos Operativos</Text>
              <Text style={styles.catValue}>{fmt(totalGastos)}</Text>
            </View>
            <View style={{ ...styles.catRow, backgroundColor: '#f8fafc' }}>
              <Text style={{ ...styles.catLabel, fontFamily: 'Helvetica-Bold' }}>TOTAL EGRESOS</Text>
              <Text style={{ ...styles.catValue, color: '#dc2626' }}>{fmt(totalEgresos)}</Text>
            </View>
          </View>

          {gastosPorCategoria.length > 0 && (
            <View style={{ flex: 1, padding: 8, border: '1px solid #e2e8f0', borderRadius: 4 }}>
              <Text style={styles.sectionTitle}>Gastos por Categoría</Text>
              {gastosPorCategoria.map((cat, i) => (
                <View key={i} style={styles.catRow}>
                  <Text style={styles.catLabel}>{cat.name}</Text>
                  <Text style={styles.catValue}>{fmt(cat.value)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* GASTOS TABLE */}
        {gastosFiltrados.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Gastos Registrados en el Periodo</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.thDate}>Fecha</Text>
                <Text style={styles.thConcepto}>Concepto</Text>
                <Text style={styles.thCategoria}>Categoría</Text>
                <Text style={styles.thProveedor}>Proveedor</Text>
                <Text style={styles.thMonto}>Monto</Text>
              </View>
              {gastosFiltrados.slice(0, 25).map((g, i) => (
                <View key={i} style={{ ...styles.tableRow, backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <Text style={styles.tdDate}>{g.fecha}</Text>
                  <Text style={styles.tdConcepto}>{g.concepto}</Text>
                  <Text style={styles.tdCategoria}>{CATEGORIAS_LABEL[g.categoria] || g.categoria}</Text>
                  <Text style={styles.tdProveedor}>{g.proveedor || '—'}</Text>
                  <Text style={styles.tdMonto}>{fmt(g.monto)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL GASTOS OPERATIVOS</Text>
                <Text style={{ ...styles.totalValue, color: '#dc2626' }}>{fmt(totalGastos)}</Text>
              </View>
            </View>
          </>
        )}

        <Text style={styles.disclaimer}>
          * Este documento es un reporte interno de gestión financiera. No sustituye estados financieros oficiales ni declaraciones fiscales.
        </Text>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>JBM Cítricos Premium — Reporte Financiero Interno</Text>
          <Text style={styles.footerText}>Generado por el ERP de JBM</Text>
        </View>

      </Page>
    </Document>
  );
};
