import { createHash, randomUUID } from "node:crypto";

import { describe, it } from "vitest";

import type {
  AiInterviewContextV1,
  AiQuestionResponseV1,
  AiSummaryResponseV1,
} from "@/lib/ai/contracts";
import { createModalMedGemmaAdapter } from "@/lib/ai/modal-medgemma-adapter";
import type { AiRequestIdentity } from "@/lib/ai/provider";
import type {
  DemoPersonaId,
  InterviewSlotId,
} from "@/features/interview/model/interview-domain.types";

const ACTUAL_ENABLED = process.env.RUN_MEDGEMMA_ACTUAL === "1";
const PERSONAS: DemoPersonaId[] = [
  "persona-kim",
  "persona-lee",
  "persona-park",
];
const COLD_IDLE_MS = 90_000;
const COLD_LIMIT_MS = 75_000;
const COLD_REQUEST_TIMEOUT_MS = 85_000;
const WARM_LIMIT_MS = 15_000;
const TEST_TIMEOUT_MS = 660_000;
const SLOT_IDS = new Set<InterviewSlotId>([
  "chief-complaint",
  "onset",
  "duration",
  "severity",
  "pattern",
  "associated-symptoms",
  "medications",
  "allergies",
  "safety",
]);

function requireSecretEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`actual-config-missing:${name}`);
  return value;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertCondition(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function assertQuestionQuality(
  response: AiQuestionResponseV1,
): asserts response is Extract<AiQuestionResponseV1, { kind: "question" }> {
  assertCondition(response.version === "1", "actual-question-version");
  assertCondition(response.kind === "question", "actual-question-complete");
  const { question } = response;
  assertCondition(SLOT_IDS.has(question.slot), "actual-question-slot");
  assertCondition(question.text.length <= 100, "actual-question-length");
  assertCondition(!question.text.includes("\n"), "actual-question-newline");
  assertCondition(
    (question.text.match(/[?!.。！？]/g) ?? []).length === 1,
    "actual-question-sentence-count",
  );
  assertCondition(
    !/(?:그리고|또한|거나|또는|및|하면서)/.test(question.text),
    "actual-question-multiple-intents",
  );
  assertCondition(
    !/(?:병태생리|감별진단|약동학|기왕력)/.test(question.text),
    "actual-question-difficult-korean",
  );
}

function assertSummaryQuality(response: AiSummaryResponseV1): void {
  assertCondition(response.version === "1", "actual-summary-version");
  assertCondition(response.kind === "summary", "actual-summary-kind");
  const items = [
    ...response.summary.subjective,
    ...response.summary.objective,
    ...response.summary.verificationNeeded,
  ];
  assertCondition(
    items.every((item) => item.evidenceTurnIds.length > 0),
    "actual-summary-evidence",
  );
}

async function measure<T>(operation: () => Promise<T>) {
  const started = performance.now();
  try {
    const value = await operation();
    return { elapsedMs: performance.now() - started, value };
  } catch {
    throw new Error("actual-call-failed");
  }
}

function createContext(personaId: DemoPersonaId): AiInterviewContextV1 {
  return {
    version: "1",
    interviewId: `actual-${personaId}`,
    personaId,
    currentSlot: "chief-complaint",
    filledSlots: { "chief-complaint": "합성 역할극에서 두통이 있다고 답함" },
    recentTurns: [
      {
        id: `turn-${personaId}-initial`,
        question: "어디가 불편하신가요?",
        answer: "합성 역할극에서 두통이 있다고 답함",
      },
    ],
  };
}

function addSyntheticAnswer(
  context: AiInterviewContextV1,
  response: Extract<AiQuestionResponseV1, { kind: "question" }>,
  index: number,
): AiInterviewContextV1 {
  const answer = "합성 역할극 답변입니다";
  return {
    ...context,
    currentSlot: response.question.slot,
    filledSlots: { ...context.filledSlots, [response.question.slot]: answer },
    recentTurns: [
      ...context.recentTurns,
      {
        id: `turn-${context.personaId}-${index}`,
        question: response.question.text,
        answer,
      },
    ].slice(-10),
  };
}

describe.skipIf(!ACTUAL_ENABLED).sequential("Modal MedGemma actual gate", () => {
  it(
    "세 Persona의 cold 질문, warm 질문 2회와 요약을 순차 검증한다",
    async () => {
      const runId = randomUUID();
      for (const personaId of PERSONAS) {
        const adapter = createModalMedGemmaAdapter({
          endpointUrl: requireSecretEnvironment("MODAL_MEDGEMMA_ENDPOINT_URL"),
          proxyTokenId: requireSecretEnvironment("MODAL_PROXY_TOKEN_ID"),
          proxyTokenSecret: requireSecretEnvironment(
            "MODAL_PROXY_TOKEN_SECRET",
          ),
          timeoutMs: COLD_REQUEST_TIMEOUT_MS,
        });
        const identity: AiRequestIdentity = {
          sessionHash: hash(`${runId}-${personaId}-session`),
          ipHash: hash(`${runId}-ip`),
        };
        const signal = new AbortController().signal;
        let context = createContext(personaId);

        await wait(COLD_IDLE_MS);
        const cold = await measure(() =>
          adapter.requestQuestion(context, signal, identity),
        );
        assertCondition(cold.elapsedMs <= COLD_LIMIT_MS, "actual-cold-latency");
        assertQuestionQuality(cold.value);
        context = addSyntheticAnswer(context, cold.value, 1);

        for (let index = 2; index <= 3; index += 1) {
          const warm = await measure(() =>
            adapter.requestQuestion(context, signal, identity),
          );
          assertCondition(
            warm.elapsedMs <= WARM_LIMIT_MS,
            "actual-warm-latency",
          );
          assertQuestionQuality(warm.value);
          context = addSyntheticAnswer(context, warm.value, index);
        }

        const summary = await measure(() =>
          adapter.requestSummary(context, signal, identity),
        );
        assertCondition(
          summary.elapsedMs <= WARM_LIMIT_MS,
          "actual-summary-latency",
        );
        assertSummaryQuality(summary.value);
        assertCondition(
          context.recentTurns.length === 4,
          "actual-history-length",
        );
      }
    },
    TEST_TIMEOUT_MS,
  );
});
