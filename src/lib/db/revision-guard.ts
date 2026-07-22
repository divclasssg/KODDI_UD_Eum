import { RevisionConflictError } from "./errors";

export type RuntimeRevisionGuard = {
  capture(): number;
  invalidate(): void;
  assertCurrent(capturedGeneration: number): void;
};

export function createRuntimeRevisionGuard(): RuntimeRevisionGuard {
  let generation = 0;

  return {
    capture: () => generation,
    invalidate: () => {
      generation += 1;
    },
    assertCurrent: (capturedGeneration) => {
      if (capturedGeneration !== generation) {
        throw new RevisionConflictError();
      }
    },
  };
}
