import path from "node:path";
import { defineConfig } from "vitest/config";

/** Unit tests that do not need Postgres (no setupFiles / db push). */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/secret-crypto.test.ts",
      "tests/admin-platform.test.ts",
      "tests/services-fx.test.ts",
      "tests/service-currency.test.ts",
      "tests/marketing-youtube.test.ts",
      "tests/marketing-google-ads.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
