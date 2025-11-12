import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    environmentMatchGlobs: [
      ["app/api/**", "node"],
      ["lib/**", "node"],
      ["hooks/**", "jsdom"],
    ],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
