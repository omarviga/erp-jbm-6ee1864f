import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Temporal: verifica el bundle sin el binding nativo de SWC (roto en este
// entorno). No sustituye a vite.config.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
