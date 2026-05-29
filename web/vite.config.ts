import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base` is relative so the static build works under any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
