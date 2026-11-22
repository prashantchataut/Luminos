import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the same build works on GitHub Pages sub-paths and on custom domains.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
