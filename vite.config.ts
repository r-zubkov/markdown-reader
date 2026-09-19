import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: false,
      manifest: {
        id: "./",
        name: "Markdown Reader",
        short_name: "Markdown Reader",
        display: "standalone",
        lang: "ru",
        scope: "./",
        start_url: "./",
        theme_color: "#101215",
        background_color: "#101215",
        icons: [
          { src: "icons/markdown-reader.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icons/markdown-reader-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      registerType: "prompt",
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{css,html,js}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/_/u, /\/[^/?]+\.[^/]+$/u],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    // Markdown parsing runs in a dedicated Worker. This condition avoids the DOM-only
    // character-reference decoder selected by the package's browser export.
    conditions: ["worker", "browser", "module", mode],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
}));
