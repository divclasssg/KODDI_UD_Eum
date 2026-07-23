import { describe, expect, it, vi } from "vitest";

import {
  createHttpInterviewCommands,
  DirectIdentifierInputError,
} from "@/features/interview/http-interview-commands";
import type { InterviewQuestion } from "@/features/interview/model/interview-ui.types";

const QUESTION: InterviewQuestion = {
  id: "question-duration",
  slot: "duration",
  text: "증상이 시작된 지 얼마나 지났나요?",
  selection: "single",
  options: [{ id: "days", label: "며칠에 걸침" }],
};

function createCommands(fetchImplementation: typeof fetch) {
  return createHttpInterviewCommands({
    fetch: fetchImplementation,
    interviewId: "interview-demo-001",
    personaId: "persona-kim",
  });
}

describe("HTTP 문진 command", () => {
  it("저장한 답변으로 최소 context를 만들어 다음 질문을 요청한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: "1",
        kind: "question",
        question: {
          id: "question-pattern",
          slot: "pattern",
          text: "증상은 계속 이어지나요?",
          selection: "single",
          options: [{ id: "yes", label: "예" }],
        },
      }),
    );
    const commands = createCommands(fetchMock);
    const savedTurn = await commands.saveAnswer({
      draft: {
        selectedOptionIds: ["days"],
        text: "사흘 정도 된 것 같아요",
        inputMode: "text",
      },
      interviewId: "interview-demo-001",
      question: QUESTION,
    });

    const result = await commands.requestNext([savedTurn]);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "question",
        question: expect.objectContaining({ slot: "pattern" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/ai/question");
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      version: "1",
      interviewId: "interview-demo-001",
      personaId: "persona-kim",
      currentSlot: "duration",
      filledSlots: { duration: "며칠에 걸침, 사흘 정도 된 것 같아요" },
      recentTurns: [savedTurn],
    });
  });

  it("현재 history의 근거만 포함한 요약을 반환한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: "1",
        kind: "summary",
        summary: {
          subjective: [
            {
              id: "subjective-turn-001",
              text: "두통이 있음",
              evidenceTurnIds: ["turn-001"],
            },
          ],
          objective: [],
          verificationNeeded: [],
        },
      }),
    );
    const commands = createCommands(fetchMock);
    const history = [
      { id: "turn-001", question: "어디가 불편한가요?", answer: "두통이 있어요" },
    ];

    const summary = await commands.requestSummary(history);

    expect(summary.subjective[0]?.evidenceTurnIds).toEqual(["turn-001"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/summary",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("client 신뢰 경계에서도 검증된 summary item만 반환한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: "1",
        kind: "summary",
        summary: {
          subjective: [
            {
              id: "subjective-kept",
              text: "두통이 있어요",
              evidenceTurnIds: ["turn-001"],
            },
          ],
          objective: [
            {
              id: "objective-rejected",
              text: "통증은 8점",
              evidenceTurnIds: ["turn-001"],
            },
          ],
          verificationNeeded: [],
        },
      }),
    );

    await expect(
      createCommands(fetchMock).requestSummary([
        { id: "turn-001", question: "어디가 불편한가요?", answer: "두통이 있어요" },
      ]),
    ).resolves.toMatchObject({
      subjective: [expect.objectContaining({ id: "subjective-kept" })],
      objective: [],
    });
  });

  it("신뢰 경계에서 안전하지 않은 질문을 반환하지 않는다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: "1",
        kind: "question",
        question: {
          id: "question-unsafe",
          slot: "pattern",
          text: "약을 두 알 더 드시겠어요?",
          selection: "single",
          options: [{ id: "yes", label: "예" }],
        },
      }),
    );

    await expect(createCommands(fetchMock).requestNext([])).rejects.toThrow(
      "unsafe-generated-question",
    );
  });

  it("history에 없는 근거 ID가 있는 요약을 표시 대상으로 반환하지 않는다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: "1",
        kind: "summary",
        summary: {
          subjective: [
            {
              id: "subjective-missing",
              text: "확인되지 않은 내용",
              evidenceTurnIds: ["turn-missing"],
            },
          ],
          objective: [],
          verificationNeeded: [],
        },
      }),
    );
    const commands = createCommands(fetchMock);

    await expect(
      commands.requestSummary([
        { id: "turn-001", question: "질문", answer: "답변" },
      ]),
    ).rejects.toThrow("unknown-evidence-turn");
  });

  it("직접 식별정보가 있으면 fetch 전에 수정 안내용 오류를 던진다", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const commands = createCommands(fetchMock);

    await expect(
      commands.saveAnswer({
        draft: {
          selectedOptionIds: [],
          text: "연락처는 010-1234-5678입니다",
          inputMode: "text",
        },
        interviewId: "interview-demo-001",
        question: QUESTION,
      }),
    ).rejects.toBeInstanceOf(DirectIdentifierInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("새 요청과 reset, dispose가 이전 요청을 abort한다", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      const signal = init?.signal;
      if (signal) signals.push(signal);
      return new Promise<Response>(() => undefined);
    });
    const commands = createCommands(fetchMock);

    void commands.requestNext([]);
    void commands.requestNext([]);

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    commands.reset();
    expect(signals[1]?.aborted).toBe(true);

    void commands.requestNext([]);
    expect(signals[2]?.aborted).toBe(false);

    commands.dispose();
    expect(signals[2]?.aborted).toBe(true);
  });

  it("transport가 abort를 무시해도 stale 응답을 폐기한다", async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(
        Response.json({ version: "1", kind: "complete" }),
      );
    const commands = createCommands(fetchMock);

    const staleRequest = commands.requestNext([]);
    await expect(commands.requestNext([])).resolves.toEqual({ kind: "complete" });
    resolveFirst?.(Response.json({ version: "1", kind: "complete" }));

    await expect(staleRequest).rejects.toMatchObject({ name: "AbortError" });
  });
});
