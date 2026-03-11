import { useEffect, useMemo, useState } from "react";
import { useVentas } from "@/hooks/useVentas";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Search, Barcode, Wifi, RefreshCw, Printer, ShoppingCart,
  Lock, Loader2, X, User, Sparkles
} from "lucide-react";
import logoJBM from "@/assets/logo-jbm.png";
import limonImg from "@/assets/limon-producto.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NumpadMode = "qty" | "precio" | "disc";

export default function POSTab() {
  const { productos, carrito, stock, loading, agregarAlCarrito, actualizarItem, eliminarDelCarrito, limpiarCarrito, cobrar } = useVentas();
  const { user } = useAuth();
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "cheque">("efectivo");
  const [busqueda, setBusqueda] = useState("");
  const [numpadMode, setNumpadMode] = useState<NumpadMode>("qty");
  const [numpadValue, setNumpadValue] = useState("");
  const [selectedCartItem, setSelectedCartItem] = useState<string | null>(null);

  const total = useMemo(
    () => carrito.reduce((acc, item) => acc + item.cantidad * item.precio_venta, 0),
    [carrito]
  );

  const subtotal = total;
  
  // Keep UI validation aligned with backend: price cannot go below precio_base.
  const precioInvalido = carrito.some(item => item.precio_venta < (item.precio_base || item.precio_sugerido || 0));

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

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

      if (numpadMode === "qty") {
        actualizarItem(selectedCartItem, { cantidad: Math.max(1, Math.round(val)) });
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
    if (precioInvalido) {
      toast.error("Precio por debajo del costo", {
        description: "No puedes vender por debajo del precio base. Contacta al administrador para autorización."
      });
      return;
    }
    // Siempre pasar null, la DB se encarga del cliente "Público en General"
    const venta = await cobrar(null, total, metodoPago);
    if (venta) {
      setSelectedCartItem(null);
      setNumpadValue("");
    }
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {productosFiltrados.map((p) => {
              const existencia = stock[p.id] || 0;
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
                    <div className="h-32 flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-2">
                      <img
                        src={limonImg}
                        alt={p.nombre}
                        className="h-full w-auto object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{p.nombre}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-lg font-black text-gray-900">${(p.precio_sugerido || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-medium">{existencia} Cajas</p>
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
                  const precioMinimo = item.precio_base || item.precio_sugerido || 0;
                  const porDebajoBase = item.precio_venta < precioMinimo;
                  const isSelected = selectedCartItem === item.id;
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
                        <p className="text-xs font-semibold text-gray-900 truncate">{item.nombre}</p>
                        <p className="text-xs text-gray-500">{item.cantidad} × ${item.precio_venta.toFixed(2)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">${(item.cantidad * item.precio_venta).toFixed(2)}</p>
                        {porDebajoBase && (
                          <span className="text-[9px] text-red-600 font-bold flex items-center gap-0.5">
                            <Lock className="h-2.5 w-2.5" /> MIN ${precioMinimo.toFixed(0)}
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
                onClick={onCobrar}
                disabled={loading || carrito.length === 0 || precioInvalido}
                className={`col-span-5 relative py-3 rounded-lg font-bold text-base text-white transition-all h-[50px] ${
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
    </div>
  );
}
