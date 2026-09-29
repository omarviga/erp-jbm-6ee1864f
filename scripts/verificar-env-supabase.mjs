// Falla rápido con un mensaje accionable si faltan las variables de Supabase,
// en vez de generar un bundle que revienta en el navegador con
// "supabaseUrl is required". Se usa como hook prebuild y desde vite.config.ts.
//
// Lee process.env (cómo llegan en Vercel) más los archivos .env estándar.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ARCHIVOS_ENV = [".env", ".env.local", ".env.production", ".env.development"];

function parseDotenv(contenido) {
  const vars = {};
  for (const linea of contenido.split("\n")) {
    const recortada = linea.trim();
    if (!recortada || recortada.startsWith("#")) continue;
    const eq = recortada.indexOf("=");
    if (eq <= 0) continue;
    const clave = recortada.slice(0, eq).trim();
    let valor = recortada.slice(eq + 1).trim();
    if (
      valor.length >= 2 &&
      ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'")))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in vars)) vars[clave] = valor;
  }
  return vars;
}

function leerEnvArchivos(cwd) {
  const vars = {};
  for (const archivo of ARCHIVOS_ENV) {
    const ruta = join(cwd, archivo);
    if (!existsSync(ruta)) continue;
    Object.assign(vars, parseDotenv(readFileSync(ruta, "utf8")));
  }
  return vars;
}

export function verificarEnvSupabase(cwd = process.cwd()) {
  const archivos = leerEnvArchivos(cwd);
  // process.env gana sobre archivos, igual que en Vite.
  const url = (process.env.VITE_SUPABASE_URL ?? archivos.VITE_SUPABASE_URL ?? "").trim();
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    archivos.VITE_SUPABASE_PUBLISHABLE_KEY ??
    archivos.VITE_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  const faltantes = [
    !url && "VITE_SUPABASE_URL",
    !key && "VITE_SUPABASE_PUBLISHABLE_KEY (o VITE_SUPABASE_ANON_KEY)",
  ].filter(Boolean);
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno de Supabase: ${faltantes.join(", ")}. ` +
        "Defínelas en .env para desarrollo local o en el panel de tu hosting " +
        "(Vercel → Settings → Environment Variables) y vuelve a compilar: las " +
        "variables VITE_* se incluyen al compilar, no se leen en tiempo de ejecución."
    );
  }
}

const esEjecucionDirecta = process.argv[1] === fileURLToPath(import.meta.url);
if (esEjecucionDirecta) {
  try {
    verificarEnvSupabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
