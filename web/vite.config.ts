import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages base path; matches the repo name "armada" (rafmacalaba.github.io/armada/).
  base: "/armada/",
  plugins: [react()],
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  preview: {
    port: 5173,
    host: "127.0.0.1",
  },
});
