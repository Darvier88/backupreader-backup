import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["node", "default"],
    mainFields: ["main", "module"],
  },
  test: {
    environment: "node",
    testTimeout: 10000,
    fileParallelism: false,
  },
});