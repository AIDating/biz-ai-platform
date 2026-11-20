import path from "node:path";
import { defineConfig } from "vitest/config";

/** Unit tests that do not need Postgres (no setupFiles / db push). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/secret-crypto.test.ts", "tests/admin-platform.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
