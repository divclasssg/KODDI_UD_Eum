import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClinicianViewScreen } from "@/features/records/clinician-view";
import type { RecordDetailState } from "@/features/records/load-records";
import type { RecordDetailViewModel } from "@/features/records/records-view-model";
import styles from "@/features/records/records.module.scss";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace };
  return { useRouter: () => router };
});

const CLINICIAN_RECORD: RecordDetailViewModel = {
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
  safetyMessages: ["즉시 도움이 필요하면 119에 연락해 주세요."],
  clinicianAvailable: true,
};

function renderState(state: RecordDetailState) {
  return render(
    <ClinicianViewScreen
      interviewId="completed-record"
      loadState={() => Promise.resolve(state)}
    />,
  );
}

describe("ClinicianViewScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("완료·확정 기록만 의료진 정보 계층으로 표시한다", async () => {
    const { container } = renderState({
      status: "ready",
      record: CLINICIAN_RECORD,
    });

    expect(
      await screen.findByRole("heading", { name: "의료진 참고용" }),
    ).toBeVisible();
    expect(screen.getByText("진단이나 치료 안내가 아닙니다.")).toBeVisible();
    expect(
      screen.getByText(
        "사용자가 제공한 참고 정보이며 의료진 확인이 필요합니다.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("즉시 도움이 필요하면 119에 연락해 주세요."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "기록 상세로 돌아가기" }),
    ).toHaveAttribute("href", "/records/completed-record");
    expect(container.querySelector("details")).not.toBeNull();
    const disclosure = screen.getByText("원문 질문과 답변");
    expect(disclosure).toBeVisible();
    expect(disclosure).toHaveClass(styles.sourceToggle);
    expect(screen.queryByText(/프로필 수정|전체 삭제|새 문진/)).not.toBeInTheDocument();
    expect(screen.queryByText(/표시하지 않을 이름|1960-05-20/)).not.toBeInTheDocument();
  });

  it("원문 disclosure selector가 44px touch target을 보장한다", () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/features/records/records.module.scss"),
      "utf8",
    );
    const sourceToggle = stylesheet.match(/\.sourceToggle\s*\{([^}]*)\}/);

    expect(sourceToggle?.[1]).toMatch(/\bmin-height:\s*44px\s*;/);
  });

  it.each([
    {
      name: "non-completed",
      state: {
        status: "ready",
        record: {
          ...CLINICIAN_RECORD,
          statusLabel: "확인 중",
          clinicianAvailable: false,
          clinicianBlockedMessage:
            "문진을 완료한 뒤 의료진용 화면을 열 수 있어요.",
        },
      } satisfies RecordDetailState,
    },
    { name: "corrupt", state: { status: "corrupt" } satisfies RecordDetailState },
    { name: "missing", state: { status: "not-found" } satisfies RecordDetailState },
  ])("$name 기록은 summary와 snapshot content를 0건 렌더링한다", async ({ state }) => {
    renderState(state);

    expect(
      await screen.findByText("의료진용 화면을 열 수 없어요."),
    ).toBeVisible();
    expect(screen.queryByText("무릎이 어제부터 아파요.")).not.toBeInTheDocument();
    expect(screen.queryByText("통증 정도는 5예요.")).not.toBeInTheDocument();
    expect(screen.queryByText(/표시하지 않을 이름|1960-05-20/)).not.toBeInTheDocument();
  });

  it("읽기 오류를 재시도하고 관리 navigation을 노출하지 않는다", async () => {
    const loadState = vi
      .fn<(id: string) => Promise<RecordDetailState>>()
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce({ status: "ready", record: CLINICIAN_RECORD });
    render(
      <ClinicianViewScreen
        interviewId="completed-record"
        loadState={loadState}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "의료진용 화면을 불러오지 못했어요.",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));

    await waitFor(() => expect(loadState).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("heading", { name: "의료진 참고용" }),
    ).toBeVisible();
    expect(screen.queryByText(/프로필 수정|전체 삭제|새 문진/)).not.toBeInTheDocument();
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
      <ClinicianViewScreen
        interviewId="completed-record"
        loadState={loadState}
      />,
    );

    unmount();
    resolve({ status: "ready", record: CLINICIAN_RECORD });
    await Promise.resolve();

    expect(screen.queryByText("무릎이 어제부터 아파요.")).not.toBeInTheDocument();
  });
});
