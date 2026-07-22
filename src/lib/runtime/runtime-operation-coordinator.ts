import { createRuntimeRevisionGuard } from "@/lib/db/revision-guard";

export type RuntimeOperationCoordinator = {
  capture(): number;
  assertCurrent(generation: number): void;
  registerAbortController(controller: AbortController): () => void;
  registerTimer(timer: number): () => void;
  invalidateAndCancel(): void;
};

export function createRuntimeOperationCoordinator(): RuntimeOperationCoordinator {
  const guard = createRuntimeRevisionGuard();
  const controllers = new Set<AbortController>();
  const timers = new Set<number>();

  return {
    capture: guard.capture,
    assertCurrent: guard.assertCurrent,
    registerAbortController(controller) {
      controllers.add(controller);
      return () => {
        controllers.delete(controller);
      };
    },
    registerTimer(timer) {
      timers.add(timer);
      return () => {
        timers.delete(timer);
      };
    },
    invalidateAndCancel() {
      guard.invalidate();
      controllers.forEach((controller) => controller.abort());
      timers.forEach((timer) => clearTimeout(timer));
      controllers.clear();
      timers.clear();
    },
  };
}

export const browserRuntimeOperations = createRuntimeOperationCoordinator();
