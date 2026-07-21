import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL(
        "./tests/unit/server-only.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["tests/actual/**/*.actual.test.ts"],
    maxWorkers: 1,
    testTimeout: 180_000,
  },
});
