import { defineConfig } from "vitest/config";
// plugin-react (babel) en vez de plugin-react-swc: el binding nativo de SWC
// no carga en todos los entornos (ERR_SWC_NATIVE_CACHE) y dejaba la suite
// completa sin ejecutar. Solo afecta al transform de tests.
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // Valores ficticios para que los suites que importan (directa o
    // transitivamente) al cliente Supabase no fallen en la carga del módulo:
    // client.ts lanza si faltan estas variables. No hay red en su construcción.
    env: {
      VITE_SUPABASE_URL: "https://pruebas.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "clave-solo-pruebas",
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
