import "server-only";

import type {
  AiInterviewContextV1,
  AiQuestionResponseV1,
  AiSummaryResponseV1,
} from "./contracts";
import { createMockMedGemmaAdapter } from "./mock-medgemma-adapter";
import { createModalMedGemmaAdapter } from "./modal-medgemma-adapter";

export type AiRequestIdentity = {
  sessionHash: string;
  ipHash: string;
};

export interface MedGemmaProvider {
  requestQuestion(
    context: AiInterviewContextV1,
    signal: AbortSignal,
    identity: AiRequestIdentity,
  ): Promise<AiQuestionResponseV1>;
  requestSummary(
    context: AiInterviewContextV1,
    signal: AbortSignal,
    identity: AiRequestIdentity,
  ): Promise<AiSummaryResponseV1>;
}

export type MedGemmaProviderErrorCode =
  | "invalid-provider-config"
  | "provider-unavailable"
  | "provider-timeout"
  | "request-aborted"
  | "invalid-provider-response";

export class MedGemmaProviderError extends Error {
  constructor(readonly code: MedGemmaProviderErrorCode) {
    super(`MedGemma provider failed: ${code}`);
    this.name = "MedGemmaProviderError";
  }
}

type ProviderEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  | "MEDGEMMA_MODE"
  | "MEDGEMMA_TIMEOUT_MS"
  | "MODAL_MEDGEMMA_ENDPOINT_URL"
  | "MODAL_PROXY_TOKEN_ID"
  | "MODAL_PROXY_TOKEN_SECRET"
  | "MEDGEMMA_ACTUAL_DISABLED"
>>;

function readTimeout(value: string | undefined): number {
  const timeout = Number(value ?? "60000");
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60_000) {
    throw new MedGemmaProviderError("invalid-provider-config");
  }
  return timeout;
}

function readRequired(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new MedGemmaProviderError("invalid-provider-config");
  }
  return normalized;
}

export function createMedGemmaProvider(
  environment: ProviderEnvironment = process.env as ProviderEnvironment,
): MedGemmaProvider {
  if (environment.MEDGEMMA_MODE === "mock") {
    return createMockMedGemmaAdapter();
  }
  if (environment.MEDGEMMA_MODE !== "modal") {
    throw new MedGemmaProviderError("invalid-provider-config");
  }
  if (environment.MEDGEMMA_ACTUAL_DISABLED !== "0") {
    throw new MedGemmaProviderError("invalid-provider-config");
  }

  const endpointUrl = readRequired(environment.MODAL_MEDGEMMA_ENDPOINT_URL);
  try {
    if (new URL(endpointUrl).protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new MedGemmaProviderError("invalid-provider-config");
  }

  return createModalMedGemmaAdapter({
    endpointUrl,
    proxyTokenId: readRequired(environment.MODAL_PROXY_TOKEN_ID),
    proxyTokenSecret: readRequired(environment.MODAL_PROXY_TOKEN_SECRET),
    timeoutMs: readTimeout(environment.MEDGEMMA_TIMEOUT_MS),
  });
}
