import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/monaco-editor") || id.includes("node_modules/@monaco-editor")) {
            return "editor-vendor";
          }
          if (id.includes("node_modules/html2pdf.js")) {
            return "pdf-vendor";
          }
          if (id.includes("node_modules/react-router")) {
            return "router-vendor";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
});
