import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVentas } from "@/hooks/useVentas";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseCdmx } from "@/integrations/supabase/cdmx";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Barcode, Wifi, RefreshCw, Printer, ShoppingCart,
  Lock, Loader2, X, User, Sparkles, Users
} from "lucide-react";
import logoJBM from "@/assets/logo-jbm.png";
import limonImg from "@/assets/limon-producto.png";
import { normalizarNombreMostrador } from "@/lib/presentacionNombre";

type NumpadMode = "qty" | "precio" | "disc";
type FiltroProducto = "todos" | "granel" | "cajas" | "arpillas";
const UMBRAL_GRANEL_BAJO_KG = 10;

interface TicketResumen {
  ventaId?: string;
  numeroVenta: string;
  total: number;
  metodoPago: "efectivo" | "transferencia" | "cheque";
  cliente: string;
  fecha: string;
  items: {
    id: string;
    nombre: string;
    cantidad: number;
    precio_venta: number;
  }[];
}

const extraerPesoProducto = (nombre: string) => {
  const coincidencia = nombre.match(/(\d+(?:\.\d+)?)\s*kg/i);
  return coincidencia ? Number(coincidencia[1]) : null;
};

const describirPresentacion = (nombre: string) => {
  const nombreAjustado = normalizarNombreMostrador(nombre);
  const nombreNormalizado = nombreAjustado.toLowerCase();
  const peso = extraerPesoProducto(nombreAjustado);

  if (nombreNormalizado.includes("granel")) {
    return {
      etiqueta: "Granel",
      pesoKg: 1,
    };
  }

  if (nombreNormalizado.includes("arpilla")) {
    return {
      etiqueta: "Arpilla",
      pesoKg: peso,
    };
  }

  if (nombreNormalizado.includes("reja")) {
    return {
      etiqueta: "Caja reja",
      pesoKg: peso,
    };
  }

  return {
    etiqueta: "Caja",
    pesoKg: peso,
  };
};

const obtenerEstiloProducto = (nombre: string, tipo: string) => {
  const nombreNormalizado = (nombre || "").toLowerCase();
  const tipoNormalizado = (tipo || "").toLowerCase();
  const esGranel = tipoNormalizado.includes("granel") || nombreNormalizado.includes("granel");
  const esArpilla = tipoNormalizado.includes("arpilla");
  const esCajaReja = nombreNormalizado.includes("reja");

  if (esGranel) {
    return {
      badge: "Granel",
      badgeClassName: "bg-sky-100 text-sky-800",
      pesoClassName: "text-sky-700",
      fondoClassName: "from-sky-50 via-white to-lime-50",
    };
  }

  if (esArpilla) {
    return {
      badge: "Arpilla",
      badgeClassName: "bg-emerald-100 text-emerald-800",
      pesoClassName: "text-emerald-700",
      fondoClassName: "from-emerald-50 via-lime-50 to-white",
    };
  }

  if (esCajaReja) {
    return {
      badge: "Caja reja",
      badgeClassName: "bg-slate-200 text-slate-800",
      pesoClassName: "text-slate-700",
      fondoClassName: "from-slate-100 via-white to-lime-50",
    };
  }

  return {
    badge: "Caja",
    badgeClassName: "bg-amber-100 text-amber-800",
    pesoClassName: "text-amber-700",
    fondoClassName: "from-green-50 to-white",
  };
};

const esProductoAGranel = (tipo: string, nombre: string) =>
  (tipo || "").toLowerCase().includes("granel") || (nombre || "").toLowerCase().includes("granel");

const formatearCantidad = (cantidad: number, esGranel: boolean) =>
  esGranel
    ? `${cantidad.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`
    : cantidad.toLocaleString("es-MX", { maximumFractionDigits: 0 });

const obtenerCategoriaProducto = (tipo: string, nombre: string): Exclude<FiltroProducto, "todos"> => {
  if (esProductoAGranel(tipo, nombre)) return "granel";
  if ((tipo || "").toLowerCase().includes("arpilla")) return "arpillas";
  return "cajas";
};

export default function POSTab() {
  const { productos, clientes, carrito, stock, loading, agregarAlCarrito, actualizarItem, eliminarDelCarrito, limpiarCarrito, cobrar } = useVentas();
  const { user } = useAuth();
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "cheque">("efectivo");
  const [busqueda, setBusqueda] = useState("");
  const [filtroProductos, setFiltroProductos] = useState<FiltroProducto>("todos");
  const [numpadMode, setNumpadMode] = useState<NumpadMode>("qty");
  const [numpadValue, setNumpadValue] = useState("");
  const [selectedCartItem, setSelectedCartItem] = useState<string | null>(null);
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string | null>(null);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [ticketPreviewOpen, setTicketPreviewOpen] = useState(false);
  const [ticketActivo, setTicketActivo] = useState<TicketResumen | null>(null);

  useEffect(() => {
    if (clienteIdSeleccionado || clientes.length === 0) return;

    const publicoGeneral = clientes.find((cliente) =>
      cliente.nombre.trim().toLowerCase() === "público en general"
      || cliente.nombre.trim().toLowerCase() === "publico en general"
    );

    if (publicoGeneral) {
      setClienteIdSeleccionado(publicoGeneral.id);
      return;
    }

    setClienteIdSeleccionado(clientes[0].id);
  }, [clientes, clienteIdSeleccionado]);

  const clienteSeleccionado = useMemo(() => {
    if (!clienteIdSeleccionado) return null;
    return clientes.find((cliente) => cliente.id === clienteIdSeleccionado) || null;
  }, [clientes, clienteIdSeleccionado]);

  const clientesFiltrados = useMemo(() => {
    const termino = busquedaCliente.trim().toLowerCase();
    if (!termino) return clientes;

    return clientes.filter((cliente) =>
      cliente.nombre.toLowerCase().includes(termino) ||
      cliente.tipo.toLowerCase().includes(termino)
    );
  }, [busquedaCliente, clientes]);

  const {
    data: ticketsRecientes = [],
    refetch: refetchTicketsRecientes,
  } = useQuery({
    queryKey: ["tickets-pos-cdmx-recientes"],
    queryFn: async () => {
      const { data, error } = await supabaseCdmx
        .from("tickets_pos_cdmx")
        .select("venta_id, numero_venta, cliente_nombre, metodo_pago, total, created_at, items")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data || []).map((ticket) => ({
        ventaId: ticket.venta_id,
        numeroVenta: ticket.numero_venta,
        total: Number(ticket.total || 0),
        metodoPago: ticket.metodo_pago,
        cliente: ticket.cliente_nombre,
        fecha: ticket.created_at,
        items: Array.isArray(ticket.items)
          ? ticket.items.map((item, index) => ({
              id: String(item.id || item.nombre || index),
              nombre: String(item.nombre || "Producto"),
              cantidad: Number(item.cantidad || 0),
              precio_venta: Number(item.precio_venta || 0),
            }))
          : [],
      })) as TicketResumen[];
    },
  });

  useEffect(() => {
    if (!ticketActivo && ticketsRecientes.length > 0) {
      setTicketActivo(ticketsRecientes[0]);
      return;
    }

    if (ticketActivo) {
      const ticketActualizado = ticketsRecientes.find(
        (ticket) => ticket.ventaId && ticket.ventaId === ticketActivo.ventaId
      );
      if (ticketActualizado) {
        setTicketActivo(ticketActualizado);
      }
    }
  }, [ticketsRecientes, ticketActivo]);

  const total = useMemo(
    () => carrito.reduce((acc, item) => acc + item.cantidad * item.precio_venta, 0),
    [carrito]
  );

  const subtotal = total;
  
  // CRITICAL: Price lock validation - precio_venta MUST be >= precio_base (precio_sugerido)
  const precioInvalido = carrito.some(item => item.precio_venta < (item.precio_sugerido || 0));

  const resumenProductos = useMemo(() => {
    return productos.reduce((acc, producto) => {
      const categoria = obtenerCategoriaProducto(producto.tipo, producto.nombre);
      acc.todos += 1;
      acc[categoria] += 1;
      return acc;
    }, {
      todos: 0,
      granel: 0,
      cajas: 0,
      arpillas: 0,
    });
  }, [productos]);

  const kilosGranelDisponibles = useMemo(() => {
    return productos.reduce((sum, producto) => {
      if (!esProductoAGranel(producto.tipo, producto.nombre)) return sum;
      return sum + Number(stock[producto.id] || 0);
    }, 0);
  }, [productos, stock]);

  const sinGranelDisponible = resumenProductos.granel > 0 && kilosGranelDisponibles <= 0;
  const granelBajo = kilosGranelDisponibles > 0 && kilosGranelDisponibles < UMBRAL_GRANEL_BAJO_KG;

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return [...productos]
      .filter((producto) => {
        const coincideBusqueda = !termino || producto.nombre.toLowerCase().includes(termino);
        if (!coincideBusqueda) return false;

        if (filtroProductos === "todos") return true;
        return obtenerCategoriaProducto(producto.tipo, producto.nombre) === filtroProductos;
      })
      .sort((a, b) => {
        const aEsGranel = esProductoAGranel(a.tipo, a.nombre);
        const bEsGranel = esProductoAGranel(b.tipo, b.nombre);
        if (aEsGranel !== bEsGranel) return aEsGranel ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, "es-MX");
      });
  }, [productos, busqueda, filtroProductos]);

  const handleNumpad = (key: string) => {
    if (key === "C") {
      setNumpadValue("");
      return;
    }
    if (key === "⌫") {
      setNumpadValue(prev => prev.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (numpadValue.includes(".")) return;
      setNumpadValue(prev => prev + ".");
      return;
    }
    if (key === "ENTER") {
      if (!selectedCartItem || !numpadValue) return;
      const val = parseFloat(numpadValue);
      if (isNaN(val)) return;
      const itemSeleccionado = carrito.find((item) => item.id === selectedCartItem);
      const esGranel = itemSeleccionado
        ? esProductoAGranel(itemSeleccionado.tipo, itemSeleccionado.nombre)
        : false;

      if (numpadMode === "qty") {
        actualizarItem(selectedCartItem, { cantidad: esGranel ? Math.max(0.1, val) : Math.max(1, Math.round(val)) });
      } else if (numpadMode === "precio") {
        actualizarItem(selectedCartItem, { precio_venta: val });
      }
      setNumpadValue("");
      return;
    }
    setNumpadValue(prev => prev + key);
  };

  const onCobrar = async () => {
    if (carrito.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    if (!clienteIdSeleccionado) {
      toast.error("Selecciona un cliente para cobrar", {
        description: "Configura al menos 'Público en general' antes de procesar la venta."
      });
      return;
    }
    if (precioInvalido) {
      toast.error("Precio por debajo del costo", {
        description: "No puedes vender por debajo del precio base. Contacta al administrador para autorización."
      });
      return;
    }

    const snapshotTicket: TicketResumen = {
      numeroVenta: "Procesando...",
      total,
      metodoPago,
      cliente: clienteSeleccionado?.nombre || "Público en general",
      fecha: new Date().toISOString(),
      items: carrito.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_venta: item.precio_venta,
      })),
    };

    const venta = await cobrar(clienteIdSeleccionado, total, metodoPago);
    if (venta) {
      const { data: ticketDB } = await supabaseCdmx
        .from("tickets_pos_cdmx")
        .select("venta_id, numero_venta, cliente_nombre, metodo_pago, total, created_at, items")
        .eq("venta_id", venta.id)
        .single();

      if (ticketDB) {
        const nuevoTicket = {
          ventaId: ticketDB.venta_id,
          numeroVenta: ticketDB.numero_venta,
          total: Number(ticketDB.total || 0),
          metodoPago: ticketDB.metodo_pago,
          cliente: ticketDB.cliente_nombre,
          fecha: ticketDB.created_at,
          items: Array.isArray(ticketDB.items)
            ? ticketDB.items.map((item, index) => ({
                id: String(item.id || item.nombre || index),
                nombre: String(item.nombre || "Producto"),
                cantidad: Number(item.cantidad || 0),
                precio_venta: Number(item.precio_venta || 0),
              }))
            : snapshotTicket.items,
        };
        setTicketActivo(nuevoTicket);
        setTicketPreviewOpen(true);
      } else {
        const nuevoTicket = {
          ...snapshotTicket,
          ventaId: venta.id,
          numeroVenta: venta.numero_venta || "Sin folio",
          fecha: venta.created_at || snapshotTicket.fecha,
        };
        setTicketActivo(nuevoTicket);
        setTicketPreviewOpen(true);
      }

      await refetchTicketsRecientes();
      setSelectedCartItem(null);
      setNumpadValue("");
      toast.success("Venta registrada correctamente");
    }
  };

  const seleccionarCliente = (clienteId: string) => {
    setClienteIdSeleccionado(clienteId);
    setClienteDialogOpen(false);
    setBusquedaCliente("");
  };

  const imprimirTicket = () => {
    if (!ticketActivo) return;

    const ticketWindow = window.open("", "_blank", "width=420,height=720");
    if (!ticketWindow) {
      toast.error("No se pudo abrir la ventana de impresión");
      return;
    }

    const filas = ticketActivo.items.map((item) => {
      const presentacion = describirPresentacion(item.nombre);
      const esGranel = presentacion.etiqueta === "Granel";
      const kilosTotales = presentacion.pesoKg ? item.cantidad * presentacion.pesoKg : null;

      return `
      <tr>
        <td>
            <div style="font-weight:700;">${normalizarNombreMostrador(item.nombre)}</div>
          <div style="font-size:10px;color:#64748b;">
            ${presentacion.etiqueta}${!esGranel && presentacion.pesoKg ? ` · ${presentacion.pesoKg} kg` : ""}
            ${kilosTotales ? ` · ${kilosTotales.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg totales` : ""}
          </div>
        </td>
        <td style="text-align:center;">${formatearCantidad(item.cantidad, esGranel)}</td>
        <td style="text-align:right;">$${item.precio_venta.toFixed(2)}</td>
        <td style="text-align:right;">$${(item.cantidad * item.precio_venta).toFixed(2)}</td>
      </tr>
    `;
    }).join("");

    ticketWindow.document.write(`
      <html>
        <head>
          <title>${ticketActivo.numeroVenta}</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f8fafc; padding: 16px; color: #111827; }
            .ticket { max-width: 320px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
            .inner { padding: 16px; }
            .header { border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px; text-align: center; }
            .logo { height: 54px; width: auto; margin: 0 auto 6px; display: block; object-fit: contain; }
            .title { font-weight: 800; font-size: 18px; letter-spacing: 0.08em; margin-bottom: 2px; }
            .subtitle { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.22em; margin-bottom: 10px; }
            .folio { font-size: 24px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
            .fecha { font-size: 10px; color: #64748b; }
            .meta { font-size: 11px; margin: 12px 0; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; }
            .meta-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
            .meta-label { font-weight: 700; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { padding: 6px 0; border-bottom: 1px dashed #d1d5db; }
            th { color: #64748b; font-size: 10px; letter-spacing: 0.08em; }
            .totals { margin-top: 12px; font-size: 11px; }
            .total { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; background: #0f172a; color: white; padding: 8px 10px; font-weight: 800; font-size: 16px; }
            .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #6b7280; letter-spacing: 0.18em; font-weight: 700; }
            @media print {
              body { padding: 0; background: white; }
              .ticket { max-width: none; border: none; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="inner">
              <div class="header">
                <img src="${logoJBM}" alt="JBM" class="logo" />
                <div class="title">JBM BODEGA CDMX</div>
                <div class="subtitle">Ticket de venta</div>
                <div class="folio">#${ticketActivo.numeroVenta}</div>
                <div class="fecha">${new Date(ticketActivo.fecha).toLocaleString("es-MX")}</div>
              </div>
              <div class="meta">
                <div class="meta-row"><span class="meta-label">Cliente</span><span>${ticketActivo.cliente}</span></div>
                <div class="meta-row"><span class="meta-label">Pago</span><span style="text-transform: capitalize;">${ticketActivo.metodoPago}</span></div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="text-align:left;">Producto</th>
                    <th style="text-align:center;">Cant.</th>
                    <th style="text-align:right;">P.U.</th>
                    <th style="text-align:right;">Importe</th>
                  </tr>
                </thead>
                <tbody>${filas}</tbody>
              </table>
              <div class="totals">
                <div class="total"><span>Total</span><span>$${ticketActivo.total.toFixed(2)}</span></div>
              </div>
              <div class="footer">
                GRACIAS POR SU COMPRA
              </div>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    ticketWindow.document.close();
  };

  const abrirPreviewTicket = (ticket: TicketResumen) => {
    setTicketActivo(ticket);
    setTicketPreviewOpen(true);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ===== TOP BAR ===== */}
      <header className="h-14 bg-[#1E5128] flex items-center px-4 gap-4 shrink-0">
        {/* Title */}
        <div className="flex items-center gap-3">
          <img src={logoJBM} alt="JBM" className="h-9 w-9 rounded-full object-cover bg-white p-0.5" />
          <span className="text-white font-bold text-base tracking-wide hidden sm:inline">Punto de Venta</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full h-9 pl-10 pr-10 rounded-full bg-white/90 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#2ECC71]/50"
            />
            <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Status icons */}
        <div className="flex items-center gap-3">
          <Wifi className="h-4 w-4 text-white/60" />
          <RefreshCw className="h-4 w-4 text-white/60" />
          <Printer className="h-4 w-4 text-white/60" />
          <div className="flex items-center gap-2 ml-2">
            <div className="h-8 w-8 rounded-full bg-white/20 border-2 border-[#2ECC71] flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <span className="text-white/80 text-xs hidden md:inline">{user?.email?.split('@')[0] || 'Operador'}</span>
          </div>
        </div>
      </header>

      {/* ===== MAIN AREA ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== PRODUCT GRID ===== */}
        <main className="flex-1 p-4 overflow-y-auto">
          <div className={`mb-4 rounded-2xl border p-4 ${
            sinGranelDisponible
              ? "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-orange-50"
              : granelBajo
              ? "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50"
              : "border-sky-100 bg-gradient-to-r from-sky-50 via-white to-lime-50"
          }`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.25em] ${
                  sinGranelDisponible ? "text-rose-700" : granelBajo ? "text-amber-700" : "text-sky-700"
                }`}>Mostrador CDMX</p>
                <p className="text-sm font-semibold text-slate-900">
                  Usa el filtro de granel para ubicar primero los kilos ya abiertos.
                </p>
                <p className={`mt-1 text-sm font-bold ${
                  sinGranelDisponible ? "text-rose-900" : granelBajo ? "text-amber-900" : "text-sky-900"
                }`}>
                  Granel disponible hoy: {kilosGranelDisponibles.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
                </p>
                <p className={`mt-1 text-xs font-semibold ${
                  sinGranelDisponible ? "text-rose-700" : granelBajo ? "text-amber-700" : "text-sky-700"
                }`}>
                  {sinGranelDisponible
                    ? "Sin granel disponible. Hay que abrir cajas para mostrador."
                    : granelBajo
                    ? "Stock bajo de granel. Conviene abrir mas cajas para mostrador."
                    : "Nivel de granel suficiente para mostrador en este momento."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "todos", label: "Todos", total: resumenProductos.todos },
                  { id: "granel", label: "Granel", total: resumenProductos.granel },
                  { id: "cajas", label: "Cajas", total: resumenProductos.cajas },
                  { id: "arpillas", label: "Arpillas", total: resumenProductos.arpillas },
                ].map((filtro) => (
                  <button
                    key={filtro.id}
                    type="button"
                    onClick={() => setFiltroProductos(filtro.id as FiltroProducto)}
                    className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                      filtroProductos === filtro.id
                        ? "bg-[#1E5128] text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {filtro.label} ({filtro.total})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {productosFiltrados.map((p) => {
              const existencia = stock[p.id] || 0;
              const estiloProducto = obtenerEstiloProducto(p.nombre, p.tipo);
              const esGranel = esProductoAGranel(p.tipo, p.nombre);
              return (
                <button
                  key={p.id}
                  onClick={() => existencia > 0 && agregarAlCarrito(p)}
                  disabled={existencia <= 0}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-left overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  {/* Lote tag */}
                  <div className="relative">
                    <div className="absolute top-2 left-2 z-10">
                      <span className="text-[10px] font-bold bg-[#F0EAD6] text-gray-700 px-2 py-0.5 rounded">
                        LOTE #MICH-{(Math.abs(p.id.charCodeAt(0) * 7) % 900 + 100)}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 z-10">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${estiloProducto.badgeClassName}`}>
                        {estiloProducto.badge}
                      </span>
                    </div>
                    <div className={`h-32 flex items-center justify-center bg-gradient-to-b ${estiloProducto.fondoClassName} p-2`}>
                      <img
                        src={limonImg}
                        alt={p.nombre}
                        className="h-full w-auto object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{normalizarNombreMostrador(p.nombre)}</p>
                    <p className={`text-xs font-semibold ${estiloProducto.pesoClassName}`}>
                      {esGranel ? "Venta por kilo" : `${p.peso_kg} kg por caja`}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-lg font-black text-gray-900">${(p.precio_sugerido || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-medium">
                        {esGranel
                          ? `${existencia.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg`
                          : `${existencia.toLocaleString("es-MX", { maximumFractionDigits: 0 })} cajas`}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
            {productosFiltrados.length === 0 && (
              <div className="col-span-full text-center py-20 text-gray-400">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>
        </main>

        {/* ===== RIGHT PANEL (Cart + Numpad) ===== */}
        <aside className="w-[340px] xl:w-[380px] flex flex-col bg-white border-l border-gray-200 shrink-0">
          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3">
            {carrito.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <ShoppingCart className="h-16 w-16 mb-3" />
                <p className="text-sm font-medium">Sin productos en el carrito</p>
              </div>
            ) : (
              <div className="space-y-2">
                {carrito.map((item) => {
                  const porDebajoBase = item.precio_venta < (item.precio_sugerido || 0);
                  const isSelected = selectedCartItem === item.id;
                  const esGranel = esProductoAGranel(item.tipo, item.nombre);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedCartItem(item.id)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#2ECC71]/10 border border-[#2ECC71]' :
                        porDebajoBase ? 'bg-red-50 border border-red-300' :
                        'bg-gray-50 border border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <img src={limonImg} alt="" className="h-10 w-10 rounded object-contain bg-green-50" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{normalizarNombreMostrador(item.nombre)}</p>
                        <p className="text-xs text-gray-500">{formatearCantidad(item.cantidad, esGranel)} × ${item.precio_venta.toFixed(2)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">${(item.cantidad * item.precio_venta).toFixed(2)}</p>
                        {porDebajoBase && (
                          <span className="text-[9px] text-red-600 font-bold flex items-center gap-0.5">
                            <Lock className="h-2.5 w-2.5" /> MIN ${(item.precio_sugerido || 0).toFixed(0)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarDelCarrito(item.id); }}
                        className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Numpad + Totals */}
          <div className="bg-[#F0F2F5] p-3 space-y-3 border-t border-gray-200">
            {ticketsRecientes.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Tickets recientes</p>
                    <p className="text-sm font-black text-emerald-900">{ticketsRecientes[0].numeroVenta}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 border border-emerald-200">
                    {ticketsRecientes[0].metodoPago}
                  </span>
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {ticketsRecientes.map((ticket) => (
                    <button
                      key={ticket.numeroVenta}
                      onClick={() => setTicketActivo(ticket)}
                      className={`w-full rounded-lg border p-2 text-left transition-colors ${
                        ticketActivo?.numeroVenta === ticket.numeroVenta
                          ? "border-emerald-300 bg-white"
                          : "border-emerald-100 bg-white/80 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-900">{ticket.numeroVenta}</span>
                        <span className="text-[10px] uppercase text-emerald-700">{ticket.metodoPago}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
                        <div className="truncate">Cliente: {ticket.cliente}</div>
                        <div className="text-right font-mono">${ticket.total.toFixed(2)}</div>
                        <div>{new Date(ticket.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="text-right">
                          {ticket.items.reduce((sum, item) => sum + item.cantidad, 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })} uds
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => ticketActivo && abrirPreviewTicket(ticketActivo)}
                    className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Ver ticket
                  </button>
                  <button
                    onClick={imprimirTicket}
                    className="rounded-lg bg-[#1E5128] px-3 py-2 text-xs font-semibold text-white hover:bg-[#163d1e]"
                  >
                    Imprimir
                  </button>
                </div>
              </div>
            )}

            {/* Mode buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {(["qty", "precio", "disc"] as NumpadMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setNumpadMode(mode)}
                  className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    numpadMode === mode
                      ? 'bg-[#2ECC71] text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {mode === "qty" ? "Qty" : mode === "precio" ? "Precio" : "Disc"}
                </button>
              ))}
              <div className="bg-white rounded-lg flex items-center justify-center text-xs font-mono text-gray-700 border">
                {numpadValue || "0"}
              </div>
            </div>

            {/* Numpad grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {["7","8","9","⌫","4","5","6","C","1","2","3","+/-","0",".","00","ENTER"].map(key => (
                <button
                  key={key}
                  onClick={() => handleNumpad(key === "+/-" ? "" : key === "00" ? "00" : key)}
                  className={`h-11 rounded-lg font-semibold text-sm transition-colors ${
                    key === "ENTER"
                      ? 'bg-[#2ECC71] text-white hover:bg-[#27ae60]'
                      : key === "⌫" || key === "C"
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-white text-gray-800 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {key === "ENTER" ? "↵" : key}
                </button>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span className="font-mono">${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base font-black text-gray-900">TOTAL:</span>
                <span className="text-2xl font-black text-[#2ECC71] font-mono">
                  ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="flex gap-1.5">
              {(["efectivo", "transferencia", "cheque"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    metodoPago === m
                      ? 'bg-[#1E5128] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Client + Pay */}
            <div className="grid grid-cols-5 gap-2">
              <button
                onClick={() => setClienteDialogOpen(true)}
                className="col-span-2 flex items-center justify-center gap-1.5 py-3 bg-white rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="truncate px-1">{clienteSeleccionado?.nombre || "Elegir cliente"}</span>
              </button>
              <button
                onClick={onCobrar}
                disabled={loading || carrito.length === 0 || precioInvalido}
                className={`col-span-3 relative py-3 rounded-lg font-bold text-base text-white transition-all ${
                  precioInvalido
                    ? 'bg-red-400 cursor-not-allowed'
                    : carrito.length === 0
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-[#2ECC71] hover:bg-[#27ae60] active:scale-[0.98] shadow-lg shadow-green-200'
                } disabled:opacity-70`}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : precioInvalido ? (
                  <span className="flex items-center justify-center gap-2"><Lock className="h-4 w-4" /> Bloqueado</span>
                ) : (
                  'Pagar'
                )}
                {!precioInvalido && carrito.length > 0 && !loading && (
                  <Sparkles className="absolute bottom-1 right-2 h-3.5 w-3.5 text-white/50" />
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <Dialog
        open={clienteDialogOpen}
        onOpenChange={(open) => {
          setClienteDialogOpen(open);
          if (!open) {
            setBusquedaCliente("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Seleccionar cliente</DialogTitle>
            <DialogDescription>
              Elige el cliente que se asociará a la venta POS de CDMX.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                placeholder="Buscar cliente por nombre o tipo..."
                className="pl-9"
              />
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {clientesFiltrados.map((cliente) => {
                const seleccionado = cliente.id === clienteIdSeleccionado;

                return (
                  <button
                    key={cliente.id}
                    onClick={() => seleccionarCliente(cliente.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      seleccionado
                        ? "border-[#2ECC71] bg-[#2ECC71]/10"
                        : "border-border bg-white hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{cliente.nombre}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{cliente.tipo}</p>
                      </div>
                      {seleccionado && (
                        <span className="rounded-full bg-[#1E5128] px-2 py-1 text-[10px] font-bold uppercase text-white">
                          Actual
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {clientesFiltrados.length === 0 && (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No se encontraron clientes con ese criterio.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ticketPreviewOpen} onOpenChange={setTicketPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview del ticket</DialogTitle>
            <DialogDescription>
              Revisa el comprobante antes de imprimirlo o volver a imprimirlo.
            </DialogDescription>
          </DialogHeader>

          {ticketActivo && (
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                <div className="border-b border-dashed border-emerald-200 pb-3 text-center">
                  <img src={logoJBM} alt="JBM" className="mx-auto mb-2 h-14 w-auto object-contain" />
                  <p className="text-lg font-black text-foreground">JBM Bodega CDMX</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Ticket de venta</p>
                  <p className="mt-2 text-sm font-semibold text-muted-foreground">{ticketActivo.numeroVenta}</p>
                  <p className="mt-2 text-2xl font-black leading-none text-foreground">#{ticketActivo.numeroVenta}</p>
                </div>

                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Fecha</span>
                    <span>{new Date(ticketActivo.fecha).toLocaleString("es-MX")}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="text-right">{ticketActivo.cliente}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Pago</span>
                    <span className="capitalize">{ticketActivo.metodoPago}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-white p-3 shadow-sm">
                    <div className="space-y-2">
                      {ticketActivo.items.map((item) => {
                        const presentacion = describirPresentacion(item.nombre);
                        const esGranel = presentacion.etiqueta === "Granel";
                        const kilosTotales = presentacion.pesoKg ? item.cantidad * presentacion.pesoKg : null;

                        return (
                        <div key={`preview-${ticketActivo.numeroVenta}-${item.id}`} className="flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{normalizarNombreMostrador(item.nombre)}</p>
                            <p className="text-xs text-muted-foreground">
                              {presentacion.etiqueta}
                              {!esGranel && presentacion.pesoKg ? ` · ${presentacion.pesoKg} kg` : ""}
                              {kilosTotales ? ` · ${kilosTotales.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg totales` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatearCantidad(item.cantidad, esGranel)} x ${item.precio_venta.toFixed(2)}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono font-semibold">
                            ${(item.cantidad * item.precio_venta).toFixed(2)}
                          </span>
                        </div>
                      );
                      })}
                    </div>

                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between rounded-md bg-slate-900 px-3 py-2 text-base font-black text-white">
                      <span>Total</span>
                      <span className="font-mono">${ticketActivo.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTicketPreviewOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Cerrar
                </button>
                <button
                  onClick={imprimirTicket}
                  className="rounded-lg bg-[#1E5128] px-3 py-2 text-sm font-semibold text-white hover:bg-[#163d1e]"
                >
                  Imprimir ticket
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
