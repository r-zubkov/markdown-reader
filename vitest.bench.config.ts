import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/bench/**/*.{test,spec}.{ts,tsx,mts,mjs}"],
    restoreMocks: true,
    clearMocks: true,
  },
});
