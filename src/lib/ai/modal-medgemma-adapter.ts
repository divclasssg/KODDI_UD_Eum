import "server-only";

import type {
  AiInterviewContext,
  AiQuestionResponseForContext,
  AiSummaryResponseForContext,
} from "./contracts";
import {
  MedGemmaProviderError,
  type AiRequestIdentity,
  type MedGemmaProvider,
} from "./provider";
import {
  parseAiQuestionResponse,
  parseAiSummaryResponse,
} from "./validators";
import { validateGeneratedQuestion } from "./question-safety-validator";
import { validateSummaryEvidence } from "./summary-evidence-validator";

export { MedGemmaProviderError } from "./provider";

type ModalAdapterOptions = {
  endpointUrl: string;
  proxyTokenId: string;
  proxyTokenSecret: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

type ModalKind = "question" | "summary";

function parseModalText(responseValue: unknown): unknown {
  if (
    responseValue === null ||
    typeof responseValue !== "object" ||
    Array.isArray(responseValue) ||
    Object.keys(responseValue).length !== 1 ||
    !("text" in responseValue) ||
    typeof responseValue.text !== "string"
  ) {
    throw new MedGemmaProviderError("invalid-provider-response");
  }
  try {
    return JSON.parse(responseValue.text);
  } catch {
    throw new MedGemmaProviderError("invalid-provider-response");
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createModalMedGemmaAdapter({
  endpointUrl,
  proxyTokenId,
  proxyTokenSecret,
  timeoutMs,
  fetchImpl = fetch,
}: ModalAdapterOptions): MedGemmaProvider {
  async function request(
    kind: ModalKind,
    context: AiInterviewContext,
    callerSignal: AbortSignal,
    identity: AiRequestIdentity,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    callerSignal.addEventListener("abort", abortFromCaller, { once: true });
    if (callerSignal.aborted) controller.abort();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetchImpl(endpointUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Modal-Key": proxyTokenId,
              "Modal-Secret": proxyTokenSecret,
            },
            body: JSON.stringify({
              kind,
              context,
              session_hash: identity.sessionHash,
              ip_hash: identity.ipHash,
            }),
            cache: "no-store",
            signal: controller.signal,
          });

          if ((response.status === 429 || response.status === 503) && attempt === 0) {
            continue;
          }
          if (!response.ok) {
            throw new MedGemmaProviderError("provider-unavailable");
          }

          let envelope: unknown;
          try {
            envelope = await response.json();
          } catch {
            throw new MedGemmaProviderError("invalid-provider-response");
          }
          return parseModalText(envelope);
        } catch (error) {
          if (timedOut) {
            throw new MedGemmaProviderError("provider-timeout");
          }
          if (callerSignal.aborted || isAbortError(error)) {
            throw new MedGemmaProviderError("request-aborted");
          }
          if (error instanceof MedGemmaProviderError) throw error;
          if (error instanceof TypeError && attempt === 0) continue;
          throw new MedGemmaProviderError("provider-unavailable");
        }
      }
      throw new MedGemmaProviderError("provider-unavailable");
    } finally {
      clearTimeout(timeout);
      callerSignal.removeEventListener("abort", abortFromCaller);
    }
  }

  return {
    async requestQuestion<TContext extends AiInterviewContext>(
      context: TContext,
      signal: AbortSignal,
      identity: AiRequestIdentity,
    ): Promise<AiQuestionResponseForContext<TContext>> {
      const value = await request("question", context, signal, identity);
      try {
        const parsed = parseAiQuestionResponse(
          value,
          context.version,
        );
        if (
          parsed.kind === "question" &&
          validateGeneratedQuestion(
            parsed.question,
            context.recentTurns.map((turn) => turn.question),
            context.recentTurns.map((turn) => turn.answer),
          ).status === "invalid"
        ) {
          throw new MedGemmaProviderError("invalid-provider-response");
        }
        return parsed as AiQuestionResponseForContext<TContext>;
      } catch {
        throw new MedGemmaProviderError("invalid-provider-response");
      }
    },
    async requestSummary<TContext extends AiInterviewContext>(
      context: TContext,
      signal: AbortSignal,
      identity: AiRequestIdentity,
    ): Promise<AiSummaryResponseForContext<TContext>> {
      const value = await request("summary", context, signal, identity);
      try {
        const parsed = parseAiSummaryResponse(
          value,
          context.version,
          new Set(context.recentTurns.map((turn) => turn.id)),
        );
        const validation = validateSummaryEvidence(
          parsed.summary,
          context.recentTurns,
        );
        if (validation.usedFallback) {
          throw new MedGemmaProviderError("invalid-provider-response");
        }
        return {
          ...parsed,
          summary: validation.summary,
        } as AiSummaryResponseForContext<TContext>;
      } catch {
        throw new MedGemmaProviderError("invalid-provider-response");
      }
    },
  };
}
