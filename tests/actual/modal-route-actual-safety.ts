import type { TestInfo } from "@playwright/test";

export const MODAL_ROUTE_ACTUAL_ENABLED =
  process.env.RUN_MEDGEMMA_ROUTE_ACTUAL === "1";

export const MODAL_ROUTE_ACTUAL_SKIP_REASON =
  "브라우저 actual gate는 명시적으로 활성화한다";

export function annotateKillSwitchRecovery(testInfo: TestInfo): void {
  testInfo.annotations.push({
    type: "kill-switch-recovery",
    description:
      "성공과 실패 모두에서 kill switch 1 재배포, 인증 503, 실행 container 0을 확인한다.",
  });
}
