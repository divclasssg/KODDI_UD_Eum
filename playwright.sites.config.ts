import { randomBytes } from "node:crypto";

import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config";

const sitesPort = 4173;
const sitesOrigin = `http://127.0.0.1:${sitesPort}`;
const webServerEnvironment = {
  ...process.env,
  DEMO_ALLOWED_ORIGIN: sitesOrigin,
  DEMO_HMAC_SECRET: randomBytes(32).toString("hex"),
  INTERVIEW_FIXTURE_MODE: "1",
  MEDGEMMA_MAX_REQUEST_BYTES: "8192",
  MEDGEMMA_MODE: "mock",
} as Record<string, string>;

export default defineConfig({
  ...baseConfig,
  testDir: "./tests",
  testMatch: [
    "e2e/**/*.spec.ts",
    "e2e-sites/**/*.spec.ts",
  ],
  use: {
    ...baseConfig.use,
    baseURL: sitesOrigin,
  },
  webServer: {
    command: `npm run build:sites && npm run start:sites -- --port ${sitesPort}`,
    env: webServerEnvironment,
    url: sitesOrigin,
    reuseExistingServer: false,
  },
});
