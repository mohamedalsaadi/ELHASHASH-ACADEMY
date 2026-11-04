import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // Same "@/*" mapping as tsconfig.json, so a test can import a module that does not live
  // beside it (payments.ts pulls db, notify and analytics through it).
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  // e2e/ holds the Playwright suite (npm run e2e), not unit tests.
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
});
