import type { InterviewApplicationRepositoryPort } from "../application/interview-application-service";
import type { SessionSnapshot } from "../domain/interview-machine";
import type {
  AiInterviewService,
  AiServiceSnapshot,
} from "./ai-interview-service";
import type { RuntimeOperationCoordinator } from "@/lib/runtime/runtime-operation-coordinator";

type Dependencies = {
  service: AiInterviewService;
  runtimeCoordinator: Pick<
    RuntimeOperationCoordinator,
    "registerAbortController"
  >;
};

export type AiInterviewApplicationRepositoryPort =
  InterviewApplicationRepositoryPort & {
    requestAiQuestion: NonNullable<
      InterviewApplicationRepositoryPort["requestAiQuestion"]
    >;
    requestAiSummary: NonNullable<
      InterviewApplicationRepositoryPort["requestAiSummary"]
    >;
    acknowledgeSafety: NonNullable<
      InterviewApplicationRepositoryPort["acknowledgeSafety"]
    >;
    reset(): void;
    dispose(): void;
  };

function toSessionSnapshot(snapshot: AiServiceSnapshot): SessionSnapshot {
  if (snapshot.phase === "safety-stopped") {
    throw new Error("unexpected-safety-stopped-snapshot");
  }
  return structuredClone(snapshot);
}

export function createAiInterviewApplicationRepositoryPort({
  service,
  runtimeCoordinator,
}: Dependencies): AiInterviewApplicationRepositoryPort {
  const activeControllers = new Map<AbortController, () => void>();

  const abortActive = () => {
    activeControllers.forEach((_unregister, controller) => controller.abort());
    activeControllers.forEach((unregister) => unregister());
    activeControllers.clear();
  };

  const runAbortable = async <Value>(
    operation: (signal: AbortSignal) => Promise<Value>,
  ): Promise<Value> => {
    const controller = new AbortController();
    const unregister = runtimeCoordinator.registerAbortController(controller);
    activeControllers.set(controller, unregister);
    try {
      return await operation(controller.signal);
    } finally {
      activeControllers.delete(controller);
      unregister();
    }
  };

  return {
    async loadOrCreateManual(input) {
      return toSessionSnapshot(await service.loadOrCreate(input));
    },
    async persistDraft(input) {
      return toSessionSnapshot(await service.persistDraft(input));
    },
    async submitAnswer(input) {
      return toSessionSnapshot(await service.submitAnswer(input));
    },
    async requestAiQuestion(input) {
      return runAbortable(async (signal) =>
        toSessionSnapshot(await service.requestAiQuestion({ ...input, signal }))
      );
    },
    async requestAiSummary(input) {
      return runAbortable(async (signal) => {
        const snapshot = await service.requestAiSummary({ ...input, signal });
        if (snapshot.phase !== "review") {
          throw new Error("unexpected-ai-summary-snapshot");
        }
        return structuredClone(snapshot);
      });
    },
    async acknowledgeSafety(input) {
      await service.acknowledgeSafety(input);
    },
    async complete(input) {
      await service.complete(input);
    },
    reset: abortActive,
    dispose: abortActive,
  };
}
