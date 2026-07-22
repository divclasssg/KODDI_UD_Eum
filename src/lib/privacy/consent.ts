import type { ConsentDecisionV1 } from "../db/contracts";

export function shouldOpenLocalDatabase(decision: ConsentDecisionV1): boolean {
  return (
    decision.localStorage === "granted" &&
    decision.sensitiveHealth === "granted"
  );
}

export function isAiTransferAllowed(decision: ConsentDecisionV1): boolean {
  return (
    decision.localStorage === "granted" &&
    decision.sensitiveHealth === "granted" &&
    decision.aiTransfer === "granted"
  );
}
