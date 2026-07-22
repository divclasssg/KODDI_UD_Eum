import { afterEach, describe, expect, it, vi } from "vitest";

import { RevisionConflictError } from "@/lib/db/errors";
import { createRuntimeOperationCoordinator } from "@/lib/runtime/runtime-operation-coordinator";

describe("runtime operation coordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reset 경계에서 등록 요청과 timer를 취소하고 이전 generation을 거부한다", () => {
    vi.useFakeTimers();
    const coordinator = createRuntimeOperationCoordinator();
    const controller = new AbortController();
    const timerCallback = vi.fn();
    const timer = setTimeout(timerCallback, 1_000);
    const captured = coordinator.capture();
    coordinator.registerAbortController(controller);
    coordinator.registerTimer(timer);

    coordinator.invalidateAndCancel();

    expect(controller.signal.aborted).toBe(true);
    expect(() => coordinator.assertCurrent(captured)).toThrow(
      RevisionConflictError,
    );
    vi.runAllTimers();
    expect(timerCallback).not.toHaveBeenCalled();
  });

  it("등록 해제한 요청과 timer는 취소하지 않는다", () => {
    vi.useFakeTimers();
    const coordinator = createRuntimeOperationCoordinator();
    const controller = new AbortController();
    const timerCallback = vi.fn();
    const timer = setTimeout(timerCallback, 1_000);
    coordinator.registerAbortController(controller)();
    coordinator.registerTimer(timer)();

    coordinator.invalidateAndCancel();
    vi.runAllTimers();

    expect(controller.signal.aborted).toBe(false);
    expect(timerCallback).toHaveBeenCalledOnce();
  });
});
