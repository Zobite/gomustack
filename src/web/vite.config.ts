import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/ui/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      src: resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5611,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: `http://${process.env.API_HOST || "127.0.0.1"}:${process.env.API_PORT || 5610}`,
        changeOrigin: true,
      },
      "/public": {
        target: `http://${process.env.API_HOST || "127.0.0.1"}:${process.env.API_PORT || 5610}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
