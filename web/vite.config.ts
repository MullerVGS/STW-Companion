import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pagesBase = process.env.VITE_BASE_PATH;

export default defineConfig({
  base: pagesBase ? `${pagesBase.replace(/\/$/, "")}/` : "./",
  plugins: [react()],
  // Dev server runs inside Docker; bind to 0.0.0.0 so the host can reach it and
  // HMR works through the published port. Set CHOKIDAR_USEPOLLING=1 only if file
  // events don't propagate (not needed on WSL-native / Linux bind mounts).
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
