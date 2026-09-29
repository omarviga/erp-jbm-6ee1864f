import { createRoot } from "react-dom/client";
import "./index.css";

function mostrarErrorArranque(mensaje: string) {
  const root = document.getElementById("root");
  if (!root) {
    document.body.textContent = mensaje;
    return;
  }
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "min-height:100vh;display:flex;align-items:center;justify-content:center;" +
    "background:#f8fafc;font-family:system-ui,sans-serif;padding:24px;";
  const card = document.createElement("div");
  card.style.cssText =
    "max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;" +
    "padding:28px;box-shadow:0 4px 24px rgba(0,0,0,.06);";
  const titulo = document.createElement("h1");
  titulo.textContent = "No se pudo iniciar la aplicación";
  titulo.style.cssText = "font-size:20px;margin:0 0 12px;color:#0f172a;";
  const detalle = document.createElement("p");
  detalle.textContent = mensaje;
  detalle.style.cssText = "font-size:14px;line-height:1.6;color:#475569;margin:0;";
  card.append(titulo, detalle);
  wrap.append(card);
  root.append(wrap);
}

// Arranque diferido: si la configuración de Supabase falta, el import de App
// rechaza y mostramos el mensaje accionable en pantalla en vez de una página
// en blanco con un "Uncaught Error" críptico en consola.
async function boot() {
  try {
    const { default: App } = await import("./App.tsx");
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (error) {
    console.error(error);
    mostrarErrorArranque(error instanceof Error ? error.message : String(error));
  }
}

void boot();
