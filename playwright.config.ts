import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 1000, width: 1280 },
      },
    },
  ],
  webServer: {
    command: "env INTERVIEW_FIXTURE_MODE=1 npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
  },
});
