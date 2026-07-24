import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordDetailState } from "@/features/records/load-records";
import { RecordDetailScreen } from "@/features/records/record-detail";
import type { RecordDetailViewModel } from "@/features/records/records-view-model";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace };
  return { useRouter: () => router };
});

const COMPLETED_RECORD: RecordDetailViewModel = {
  id: "completed-record",
  dateLabel: "오늘",
  timeLabel: "10:30",
  statusLabel: "완료",
  modeLabel: "AI 문진",
  summarySourceLabel: "AI가 정리한 내용",
  subjective: ["무릎이 어제부터 아파요."],
  objective: ["통증 정도는 5예요."],
  verificationNeeded: ["정확한 시작 시각은 확인이 필요해요."],
  turns: [
    { question: "어디가 불편한가요?", answer: "무릎이 불편해요." },
  ],
  safetyMessages: [],
  clinicianAvailable: true,
};

function renderState(state: RecordDetailState) {
  return render(
    <RecordDetailScreen
      interviewId="completed-record"
      loadState={() => Promise.resolve(state)}
    />,
  );
}

describe("RecordDetailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("프로필 저장 직후 destination에서 성공 상태를 한 번 표시한다", async () => {
    sessionStorage.setItem("koddi.profile-save-success", "true");

    const { unmount } = renderState({
      status: "ready",
      record: COMPLETED_RECORD,
    });

    const status = await screen.findByText("변경사항을 저장했어요.");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toBeVisible();
    expect(sessionStorage.getItem("koddi.profile-save-success")).toBeNull();

    unmount();
    renderState({ status: "ready", record: COMPLETED_RECORD });
    await screen.findByRole("heading", { name: "문진 기록" });
    expect(
      screen.queryByText("변경사항을 저장했어요."),
    ).not.toBeInTheDocument();
  });

  it("요약, 원문, clinician link를 승인된 순서와 copy로 표시한다", async () => {
    renderState({ status: "ready", record: COMPLETED_RECORD });

    expect(
      await screen.findByRole("heading", { name: "문진 기록" }),
    ).toBeVisible();
    expect(screen.getByText("AI가 정리한 내용")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "S · 사용자가 말한 내용" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "O · 참고 정보" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "확인 필요" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "원문 질문과 답변" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "의료진에게 보여주기" }),
    ).toHaveAttribute("href", "/records/completed-record/clinician");
    expect(
      screen.getByRole("link", { name: "내 정보 수정" }),
    ).toHaveAttribute(
      "href",
      "/profile?returnTo=%2Frecords%2Fcompleted-record",
    );
    expect(screen.getByRole("link", { name: "기록 목록으로" })).toHaveAttribute(
      "href",
      `/records#record-${encodeURIComponent(COMPLETED_RECORD.id)}`,
    );
    expect(
      screen.getAllByRole("heading").map(({ textContent }) => textContent),
    ).toEqual([
      "문진 기록",
      "S · 사용자가 말한 내용",
      "O · 참고 정보",
      "확인 필요",
      "원문 질문과 답변",
    ]);
  });

  it.each([
    [
      "review",
      "확인 중",
      "문진을 완료한 뒤 의료진용 화면을 열 수 있어요.",
    ],
    [
      "draft",
      "작성 중",
      "문진을 완료한 뒤 의료진용 화면을 열 수 있어요.",
    ],
    [
      "safety-stopped",
      "안전 안내 후 중단",
      "안전 안내로 중단된 기록은 원문을 확인해 주세요.",
    ],
  ] as const)(
    "%s 기록은 clinician link 없이 차단 copy를 표시한다",
    async (_, statusLabel, clinicianBlockedMessage) => {
      renderState({
        status: "ready",
        record: {
          ...COMPLETED_RECORD,
          statusLabel,
          clinicianAvailable: false,
          clinicianBlockedMessage,
        },
      });

      expect(await screen.findByText(clinicianBlockedMessage)).toBeVisible();
      expect(
        screen.queryByRole("link", { name: "의료진에게 보여주기" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    ["not-found", { status: "not-found" }],
    ["corrupt", { status: "corrupt" }],
    ["error", { status: "error" }],
  ] as const)("%s 상태는 내 정보 수정 link를 표시하지 않는다", async (_, state) => {
    renderState(state);

    if (state.status === "error") {
      await screen.findByRole("alert");
    } else if (state.status === "not-found") {
      await screen.findByText("기록을 찾을 수 없어요.");
    } else {
      await screen.findByText("이 기록을 안전하게 표시할 수 없어요.");
    }

    expect(
      screen.queryByRole("link", { name: "내 정보 수정" }),
    ).not.toBeInTheDocument();
  });

  it("not-found와 corrupt는 의료 내용을 노출하지 않는다", async () => {
    const { rerender } = renderState({ status: "not-found" });

    expect(await screen.findByText("기록을 찾을 수 없어요.")).toBeVisible();
    expect(screen.queryByText("무릎이 어제부터 아파요.")).not.toBeInTheDocument();

    rerender(
      <RecordDetailScreen
        interviewId="completed-record"
        loadState={() => Promise.resolve({ status: "corrupt" })}
      />,
    );
    expect(
      await screen.findByText("이 기록을 안전하게 표시할 수 없어요."),
    ).toBeVisible();
    expect(screen.queryByText("무릎이 어제부터 아파요.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "기록 목록으로" })).toHaveAttribute(
      "href",
      "/records",
    );
    expect(
      screen.getByRole("link", { name: "저장된 정보 모두 삭제" }),
    ).toHaveAttribute("href", "/settings/data");
  });

  it("읽기 오류를 재시도한다", async () => {
    const loadState = vi
      .fn<(id: string) => Promise<RecordDetailState>>()
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce({ status: "ready", record: COMPLETED_RECORD });
    render(
      <RecordDetailScreen
        interviewId="completed-record"
        loadState={loadState}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "기록을 불러오지 못했어요.",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));

    await waitFor(() => expect(loadState).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("무릎이 어제부터 아파요.")).toBeVisible();
  });

  it("database 없음은 온보딩으로 이동한다", async () => {
    renderState({ status: "missing-database" });

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/onboarding"),
    );
  });

  it("unmount 뒤 늦은 loader 결과를 적용하지 않는다", async () => {
    let resolve!: (state: RecordDetailState) => void;
    const loadState = () =>
      new Promise<RecordDetailState>((resolvePromise) => {
        resolve = resolvePromise;
      });
    const { unmount } = render(
      <RecordDetailScreen
        interviewId="completed-record"
        loadState={loadState}
      />,
    );

    unmount();
    resolve({ status: "ready", record: COMPLETED_RECORD });
    await Promise.resolve();

    expect(screen.queryByText("무릎이 어제부터 아파요.")).not.toBeInTheDocument();
  });
});
