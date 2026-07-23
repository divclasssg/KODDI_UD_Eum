import { randomBytes } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const webServerEnvironment = {
  ...process.env,
  DEMO_ALLOWED_ORIGIN: "http://127.0.0.1:3101",
  DEMO_HMAC_SECRET: randomBytes(32).toString("hex"),
  MEDGEMMA_TIMEOUT_MS: "180000",
  PUBLIC_AI_MAX_FOLLOW_UPS: "1",
} as Record<string, string>;

export default defineConfig({
  testDir: "./tests/actual",
  testMatch: "**/*.actual.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3101",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start -- --port 3101",
    env: webServerEnvironment,
    reuseExistingServer: false,
    url: "http://127.0.0.1:3101",
  },
});
