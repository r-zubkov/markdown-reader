import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "virtual:pwa-register", replacement: fileURLToPath(new URL("./src/test/pwa-register-stub.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx,mts,mjs}"],
    exclude: ["src/test/security/**", "src/test/bench/**"],
    restoreMocks: true,
    clearMocks: true,
  },
});
