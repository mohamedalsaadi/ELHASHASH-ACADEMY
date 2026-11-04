import { configDefaults, defineConfig } from "vitest/config";

// e2e/ holds the Playwright suite (npm run e2e), not unit tests.
export default defineConfig({ test: { exclude: [...configDefaults.exclude, "e2e/**"] } });
