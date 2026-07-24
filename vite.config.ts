import vinext from "vinext";
import { defineConfig } from "vite";

import { sites } from "./sites/sites-vite-plugin";

const workerVariableNames = [
  "DEMO_ALLOWED_ORIGIN",
  "DEMO_HMAC_SECRET",
  "INTERVIEW_FIXTURE_MODE",
  "MEDGEMMA_ACTUAL_DISABLED",
  "MEDGEMMA_MAX_REQUEST_BYTES",
  "MEDGEMMA_MODE",
  "MEDGEMMA_TIMEOUT_MS",
  "MODAL_MEDGEMMA_ENDPOINT_URL",
  "MODAL_PROXY_TOKEN_ID",
  "MODAL_PROXY_TOKEN_SECRET",
  "PUBLIC_AI_MAX_FOLLOW_UPS",
] as const;

export default defineConfig(async () => {
  // 로컬 Sites 검증 상태는 저장소 내부에만 유지한다.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const workerVars = Object.fromEntries(
    workerVariableNames.flatMap((name) => {
      const value = process.env[name];
      return value === undefined ? [] : [[name, value]];
    }),
  );

  return {
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        inspectorPort: false,
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          main: "vinext/server/fetch-handler",
          compatibility_flags: ["nodejs_compat"],
          vars: workerVars,
        },
      }),
    ],
  };
});
