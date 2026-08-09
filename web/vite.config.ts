import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
