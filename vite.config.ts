import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("@react-pdf") || id.includes("pdfjs-dist")) {
            return "pdf";
          }

          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("@radix-ui") || id.includes("lucide-react")) {
            return "ui";
          }
        },
      },
    },
  },
}));
