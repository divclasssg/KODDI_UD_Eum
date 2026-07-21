import type {
  AiInterviewContextV1,
  AiQuestionResponseV1,
  AiSummaryResponseV1,
} from "@/lib/ai/contracts";
import {
  parseAiQuestionResponseV1,
  parseAiSummaryResponseV1,
} from "@/lib/ai/validators";
import { findDirectIdentifier } from "@/lib/demo/direct-identifier";

import type {
  InterviewCommandsPort,
  SaveAnswerInput,
} from "./interview-commands";
import type {
  DemoPersonaId,
  InterviewSlotId,
} from "./model/interview-domain.types";
import type { InterviewTurn } from "./model/interview-ui.types";

export class DirectIdentifierInputError extends Error {
  constructor() {
    super("direct-identifier");
    this.name = "DirectIdentifierInputError";
  }
}

export class HttpInterviewRequestError extends Error {
  constructor(readonly status: number) {
    super(`interview-request-failed:${status}`);
    this.name = "HttpInterviewRequestError";
  }
}

type HttpInterviewCommandsOptions = {
  fetch?: typeof fetch;
  interviewId: string;
  personaId: DemoPersonaId;
};

export type HttpInterviewCommands = InterviewCommandsPort & {
  dispose(): void;
  reset(): void;
};

function formatAnswer({ draft, question }: SaveAnswerInput): string {
  const labels = question.options
    .filter((option) => draft.selectedOptionIds.includes(option.id))
    .map((option) => option.label);
  const text = draft.text.trim();
  return [...labels, ...(text ? [text] : [])].join(", ");
}

export function createHttpInterviewCommands({
  fetch: fetchImplementation = globalThis.fetch,
  interviewId,
  personaId,
}: HttpInterviewCommandsOptions): HttpInterviewCommands {
  let activeController: AbortController | undefined;
  let currentSlot: InterviewSlotId | undefined;
  let requestGeneration = 0;
  let savedTurnCount = 0;
  let filledSlots: AiInterviewContextV1["filledSlots"] = {};

  const abortPending = () => {
    requestGeneration += 1;
    activeController?.abort();
    activeController = undefined;
  };

  const createContext = (history: InterviewTurn[]): AiInterviewContextV1 => ({
    version: "1",
    interviewId,
    personaId,
    ...(currentSlot ? { currentSlot } : {}),
    filledSlots: { ...filledSlots },
    recentTurns: history.slice(-10).map((turn) => ({ ...turn })),
  });

  async function post(path: string, context: AiInterviewContextV1) {
    abortPending();
    const generation = requestGeneration;
    const controller = new AbortController();
    activeController = controller;

    try {
      const response = await fetchImplementation(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
        signal: controller.signal,
      });
      if (generation !== requestGeneration) {
        throw new DOMException("stale-interview-request", "AbortError");
      }
      if (!response.ok) throw new HttpInterviewRequestError(response.status);
      const value = await response.json();
      if (generation !== requestGeneration) {
        throw new DOMException("stale-interview-request", "AbortError");
      }
      return value;
    } finally {
      if (activeController === controller) activeController = undefined;
    }
  }

  return {
    dispose: abortPending,
    recordSafetyAction() {},
    async requestNext(history) {
      const value = (await post(
        "/api/ai/question",
        createContext(history),
      )) as AiQuestionResponseV1;
      const parsed = parseAiQuestionResponseV1(value);
      return parsed.kind === "complete"
        ? { kind: "complete" }
        : { kind: "question", question: parsed.question };
    },
    async requestSummary(history) {
      const value = (await post(
        "/api/ai/summary",
        createContext(history),
      )) as AiSummaryResponseV1;
      return parseAiSummaryResponseV1(
        value,
        new Set(history.map((turn) => turn.id)),
      ).summary;
    },
    reset() {
      abortPending();
      currentSlot = undefined;
      filledSlots = {};
      savedTurnCount = 0;
    },
    async saveAnswer(input) {
      const answer = formatAnswer(input);
      if (findDirectIdentifier(answer)) {
        throw new DirectIdentifierInputError();
      }

      currentSlot = input.question.slot;
      filledSlots = { ...filledSlots, [input.question.slot]: answer };
      savedTurnCount += 1;
      return {
        id: `turn-${interviewId}-${savedTurnCount}`,
        question: input.question.text,
        answer,
      };
    },
  };
}
