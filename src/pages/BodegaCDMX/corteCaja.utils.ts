export interface VentaAuditadaCorte {
  id: string;
  numero_venta: string;
  total: number;
  created_at: string;
  pagos_clientes: {
    id: string;
    monto: number;
    forma_pago: "efectivo" | "cheque" | "transferencia";
  }[];
}

export interface TicketPeriodoCorte {
  id: string;
  venta_id?: string | null;
  numero_venta: string;
  cliente_nombre: string;
  metodo_pago: "efectivo" | "cheque" | "transferencia";
  total: number;
  created_at: string;
  items: {
    id: string;
    nombre: string;
    cantidad: number;
    precio_venta: number;
  }[];
}

export interface IncidenciaConciliacionCorte {
  ventaId: string;
  numeroVenta: string;
  createdAt: string;
  detalle: string;
}

export interface ResultadoConciliacionCorte {
  totalVentas: number;
  totalTickets: number;
  incidencias: IncidenciaConciliacionCorte[];
  cuadrado: boolean;
}

export interface ResumenPeriodoCorte {
  totalVentas: number;
  totalEfectivo: number;
  totalTransferencia: number;
  totalCheque: number;
}

export interface AuditoriaGranelPeriodo {
  cantidad: number;
  created_at: string;
  motivo: string | null;
}

export interface ResumenGranelPeriodo {
  cajasAbiertas: number;
  kilosGenerados: number;
  kilosMermados: number;
}

type ErrorLike = {
  message?: string;
  code?: string;
};

const EPSILON_MONTO = 0.009;

export function obtenerIncidenciasAuditoria(ventas: VentaAuditadaCorte[]) {
  return ventas.filter((venta) => {
    const pagos = venta.pagos_clientes || [];
    const totalPagos = pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
    return pagos.length !== 1 || Math.abs(totalPagos - Number(venta.total || 0)) > EPSILON_MONTO;
  });
}

export function construirResumenPeriodoCorte(
  ventas: VentaAuditadaCorte[],
): ResumenPeriodoCorte {
  return ventas.reduce(
    (acc, venta) => {
      const totalVenta = Number(venta.total || 0);
      const pagos = venta.pagos_clientes || [];

      acc.totalVentas += totalVenta;

      pagos.forEach((pago) => {
        const monto = Number(pago.monto || 0);

        if (pago.forma_pago === "efectivo") acc.totalEfectivo += monto;
        if (pago.forma_pago === "transferencia") acc.totalTransferencia += monto;
        if (pago.forma_pago === "cheque") acc.totalCheque += monto;
      });

      return acc;
    },
    {
      totalVentas: 0,
      totalEfectivo: 0,
      totalTransferencia: 0,
      totalCheque: 0,
    },
  );
}

export function construirConciliacionPeriodo(
  ticketsPeriodo: TicketPeriodoCorte[],
  ventasConciliacion: VentaAuditadaCorte[],
): ResultadoConciliacionCorte {
  const ticketPorVentaId = new Map(
    ticketsPeriodo
      .filter((ticket) => ticket.venta_id)
      .map((ticket) => [ticket.venta_id as string, ticket]),
  );
  const ticketPorNumeroVenta = new Map(
    ticketsPeriodo.map((ticket) => [ticket.numero_venta, ticket]),
  );

  const incidenciasVentas = ventasConciliacion.flatMap((venta) => {
    const pagos = venta.pagos_clientes || [];
    const totalVenta = Number(venta.total || 0);
    const totalPagos = pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
    const ticket = ticketPorVentaId.get(venta.id) || ticketPorNumeroVenta.get(venta.numero_venta);
    const incidenciasVenta: IncidenciaConciliacionCorte[] = [];

    if (!ticket) {
      incidenciasVenta.push({
        ventaId: venta.id,
        numeroVenta: venta.numero_venta,
        createdAt: venta.created_at,
        detalle: "Venta con pago pero sin ticket en bitacora separada",
      });
    } else if (Math.abs(Number(ticket.total || 0) - totalVenta) > EPSILON_MONTO) {
      incidenciasVenta.push({
        ventaId: venta.id,
        numeroVenta: venta.numero_venta,
        createdAt: venta.created_at,
        detalle: `Monto ticket $${Number(ticket.total || 0).toFixed(2)} vs venta $${totalVenta.toFixed(2)}`,
      });
    }

    if (pagos.length === 0) {
      incidenciasVenta.push({
        ventaId: venta.id,
        numeroVenta: venta.numero_venta,
        createdAt: venta.created_at,
        detalle: "Venta sin pago asociado",
      });
    } else if (pagos.length > 1) {
      incidenciasVenta.push({
        ventaId: venta.id,
        numeroVenta: venta.numero_venta,
        createdAt: venta.created_at,
        detalle: `Venta con ${pagos.length} pagos asociados`,
      });
    } else if (Math.abs(totalPagos - totalVenta) > EPSILON_MONTO) {
      incidenciasVenta.push({
        ventaId: venta.id,
        numeroVenta: venta.numero_venta,
        createdAt: venta.created_at,
        detalle: `Pago $${totalPagos.toFixed(2)} vs venta $${totalVenta.toFixed(2)}`,
      });
    }

    return incidenciasVenta;
  });

  const ventasIds = new Set(ventasConciliacion.map((venta) => venta.id));
  const ticketsHuerfanos = ticketsPeriodo
    .filter((ticket) => ticket.venta_id && !ventasIds.has(ticket.venta_id))
    .map((ticket) => ({
      ventaId: ticket.venta_id as string,
      numeroVenta: ticket.numero_venta,
      createdAt: ticket.created_at,
      detalle: "Ticket en bitacora sin venta POS encontrada en el periodo",
    }));

  const incidencias = [...incidenciasVentas, ...ticketsHuerfanos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    totalVentas: ventasConciliacion.length,
    totalTickets: ticketsPeriodo.length,
    incidencias,
    cuadrado: incidencias.length === 0 && ventasConciliacion.length === ticketsPeriodo.length,
  };
}

export function resumirAuditoriaGranelPeriodo(
  auditoriaGranelPeriodo: AuditoriaGranelPeriodo[],
): ResumenGranelPeriodo {
  return auditoriaGranelPeriodo.reduce(
    (acc, item) => {
      const motivo = (item.motivo || "").toLowerCase();
      const cantidad = Number(item.cantidad || 0);

      if (motivo.includes("apertura de cajas para venta a granel")) {
        acc.cajasAbiertas += cantidad;
      }

      if (motivo.includes("conversión a granel") || motivo.includes("conversion a granel")) {
        acc.kilosGenerados += cantidad;
      }

      if (motivo.includes("merma granel:")) {
        acc.kilosMermados += cantidad;
      }

      return acc;
    },
    {
      cajasAbiertas: 0,
      kilosGenerados: 0,
      kilosMermados: 0,
    },
  );
}

export function normalizarMensajeErrorCorte(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Error desconocido";
  }

  const errorLike = error as ErrorLike;
  const message = String(errorLike.message || "");

  if (message.includes('cannot insert a non-DEFAULT value into column "diferencia"')) {
    return "La base rechazó un cálculo automático del corte. Ya quedó corregido; intenta nuevamente.";
  }

  if (
    message.includes("row-level security")
    || message.includes("new row violates row-level security policy")
  ) {
    return "Tu usuario no tiene permiso para cerrar corte. Se requiere rol admin, ventas o almacen.";
  }

  return message || "Error desconocido";
}

export function esCorteHistoricoInconsistente(corte: {
  efectivo_teorico?: number | null;
  efectivo_fisico?: number | null;
  total_efectivo?: number | null;
  total_ventas?: number | null;
}) {
  const efectivoTeorico = Number(corte.efectivo_teorico || 0);
  const efectivoFisico = Number(corte.efectivo_fisico || 0);
  const totalEfectivo = Number(corte.total_efectivo || 0);
  const totalVentas = Number(corte.total_ventas || 0);

  return efectivoTeorico === 0
    && totalEfectivo === 0
    && totalVentas === 0
    && efectivoFisico > 0;
}
