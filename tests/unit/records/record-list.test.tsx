import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordsListState } from "@/features/records/load-records";
import { RecordListScreen } from "@/features/records/record-list";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace };
  return { useRouter: () => router };
});

const READY_RECORD = {
  id: "record/한글",
  dateLabel: "오늘",
  timeLabel: "10:30",
  statusLabel: "완료",
  modeLabel: "AI 문진",
  chiefComplaint: "무릎이 불편해요.",
} as const;

function renderState(state: RecordsListState) {
  return render(
    <RecordListScreen loadState={() => Promise.resolve(state)} />,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("RecordListScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("기록 label을 보이고 인코딩된 상세 link를 제공한다", async () => {
    renderState({ status: "ready", records: [READY_RECORD] });

    const recordLink = await screen.findByRole("link", {
      name: /무릎이 불편해요/,
    });

    expect(recordLink).toHaveAttribute(
      "href",
      `/records/${encodeURIComponent(READY_RECORD.id)}`,
    );
    expect(screen.getByText("오늘")).toBeVisible();
    expect(screen.getByText("10:30")).toBeVisible();
    expect(screen.getByText("완료")).toBeVisible();
    expect(screen.getByText("AI 문진")).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("빈 목록에서 새 문진과 홈 복귀 link를 제공한다", async () => {
    renderState({ status: "ready", records: [] });

    expect(await screen.findByText("기록이 아직 없어요.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "새 문진 시작하기" }),
    ).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("missing 상태는 온보딩으로 이동한다", async () => {
    renderState({ status: "missing" });

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/onboarding"),
    );
  });

  it("읽기 실패는 민감한 원문 없이 재시도한다", async () => {
    const loadState = vi
      .fn<() => Promise<RecordsListState>>()
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce({ status: "ready", records: [] });
    render(<RecordListScreen loadState={loadState} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "기록을 불러오지 못했어요.",
    );
    expect(document.body).not.toHaveTextContent(
      /Persona|fixture|raw database error|무릎 의료정보/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));

    await waitFor(() => expect(loadState).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("기록이 아직 없어요.")).toBeVisible();
  });

  it("unmount 뒤 늦은 loader 성공으로 이동하지 않는다", async () => {
    const pending = deferred<RecordsListState>();
    const { unmount } = render(
      <RecordListScreen loadState={() => pending.promise} />,
    );

    unmount();
    await act(async () => {
      pending.resolve({ status: "missing" });
      await pending.promise;
    });

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("unmount 뒤 늦은 loader 실패를 화면 상태로 반영하지 않는다", async () => {
    const pending = deferred<RecordsListState>();
    const { unmount } = render(
      <RecordListScreen loadState={() => pending.promise} />,
    );

    unmount();
    await act(async () => {
      pending.reject(new Error("늦은 기록 읽기 실패"));
      await expect(pending.promise).rejects.toThrow("늦은 기록 읽기 실패");
    });

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
