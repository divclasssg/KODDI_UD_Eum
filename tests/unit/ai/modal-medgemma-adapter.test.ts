import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AiInterviewContextV1,
  AiInterviewContextV2,
} from "@/lib/ai/contracts";
import {
  MedGemmaProviderError,
  createModalMedGemmaAdapter,
} from "@/lib/ai/modal-medgemma-adapter";
import {
  MEDGEMMA_DEFAULT_TIMEOUT_MS,
  MEDGEMMA_MAX_TIMEOUT_MS,
  createMedGemmaProvider,
  type AiRequestIdentity,
} from "@/lib/ai/provider";

const CONTEXT: AiInterviewContextV1 = {
  version: "1",
  interviewId: "interview-demo-001",
  personaId: "persona-kim",
  currentSlot: "duration",
  filledSlots: { "chief-complaint": "두통" },
  recentTurns: [
    {
      id: "turn-001",
      question: "어디가 불편하신가요?",
      answer: "두통이 있어요",
    },
  ],
};

const PUBLIC_CONTEXT: AiInterviewContextV2 = {
  version: "2",
  interviewId: "ai-public-001",
  filledSlots: { "chief-complaint": "두통" },
  recentTurns: [],
};

const IDENTITY: AiRequestIdentity = {
  sessionHash: "a".repeat(64),
  ipHash: "b".repeat(64),
};

function responseText(payload: unknown, status = 200): Response {
  return Response.json({ text: JSON.stringify(payload) }, { status });
}

function createAdapter(fetchImpl: typeof fetch) {
  return createModalMedGemmaAdapter({
    endpointUrl: "https://demo--medgemma.modal.run",
    proxyTokenId: "token-id",
    proxyTokenSecret: "token-secret",
    timeoutMs: 60_000,
    fetchImpl,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Modal MedGemma adapter", () => {
  it("공개 V2 요청에는 같은 V2 응답만 허용한다", async () => {
    const accepted = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({ version: "2", kind: "complete" }),
      ),
    );
    await expect(
      accepted.requestQuestion(
        PUBLIC_CONTEXT,
        new AbortController().signal,
        IDENTITY,
      ),
    ).resolves.toEqual({ version: "2", kind: "complete" });

    const mismatched = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({ version: "1", kind: "complete" }),
      ),
    );
    await expect(
      mismatched.requestQuestion(
        PUBLIC_CONTEXT,
        new AbortController().signal,
        IDENTITY,
      ),
    ).rejects.toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );
  });

  it("계약 shape는 맞지만 안전하지 않은 provider 질문을 거절한다", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({
          version: "1",
          kind: "question",
          question: {
            id: "question-treatment",
            slot: "pattern",
            text: "편두통이 확실하니 쉬세요.",
            selection: "single",
            options: [{ id: "yes", label: "예" }],
          },
        }),
      ),
    );

    await expect(
      adapter.requestQuestion(CONTEXT, new AbortController().signal, IDENTITY),
    ).rejects.toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );
  });

  it("이전 답변에 물음표만 붙인 provider 질문을 거절한다", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({
          version: "1",
          kind: "question",
          question: {
            id: "question-repeated-answer",
            slot: "pattern",
            text: "두통이 있어요?",
            selection: "single",
            options: [{ id: "yes", label: "예" }],
          },
        }),
      ),
    );

    await expect(
      adapter.requestQuestion(CONTEXT, new AbortController().signal, IDENTITY),
    ).rejects.toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );
  });

  it("provider summary에서 검증된 item만 반환한다", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({
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
      ),
    );

    await expect(
      adapter.requestSummary(CONTEXT, new AbortController().signal, IDENTITY),
    ).resolves.toMatchObject({
      summary: {
        subjective: [expect.objectContaining({ id: "subjective-kept" })],
        objective: [],
      },
    });
  });

  it("검증 뒤 표시할 summary item이 없으면 fallback 신호를 provider 오류로 바꾼다", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({
          version: "1",
          kind: "summary",
          summary: {
            subjective: [
              {
                id: "subjective-rejected",
                text: "통증은 8점",
                evidenceTurnIds: ["turn-001"],
              },
            ],
            objective: [],
            verificationNeeded: [],
          },
        }),
      ),
    );

    await expect(
      adapter.requestSummary(CONTEXT, new AbortController().signal, IDENTITY),
    ).rejects.toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );
  });

  it("V1 요청에는 V2 질문과 양방향 summary 응답을 거절한다", async () => {
    const v1QuestionMismatch = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({ version: "2", kind: "complete" }),
      ),
    );
    await expect(
      v1QuestionMismatch.requestQuestion(
        CONTEXT,
        new AbortController().signal,
        IDENTITY,
      ),
    ).rejects.toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );

    const v1SummaryMismatch = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({
          version: "2",
          kind: "summary",
          summary: { subjective: [], objective: [], verificationNeeded: [] },
        }),
      ),
    );
    await expect(
      v1SummaryMismatch.requestSummary(
        CONTEXT,
        new AbortController().signal,
        IDENTITY,
      ),
    ).rejects.toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );

    const v2SummaryMismatch = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        responseText({
          version: "1",
          kind: "summary",
          summary: { subjective: [], objective: [], verificationNeeded: [] },
        }),
      ),
    );
    await expect(
      v2SummaryMismatch.requestSummary(
        PUBLIC_CONTEXT,
        new AbortController().signal,
        IDENTITY,
      ),
    ).rejects.toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );
  });

  it("비용 우선 cold timeout 범위를 고정한다", () => {
    expect(MEDGEMMA_DEFAULT_TIMEOUT_MS).toBe(75_000);
    expect(MEDGEMMA_MAX_TIMEOUT_MS).toBe(180_000);
  });

  it("proxy 인증과 허용된 네 개 필드만 Modal에 보낸다", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      responseText({
        version: "1",
        kind: "question",
        question: {
          id: "question-pattern",
          slot: "pattern",
          text: "증상은 계속 이어지나요?",
          selection: "single",
          options: [
            { id: "yes", label: "예" },
            { id: "no", label: "아니요" },
          ],
        },
      }),
    );

    const result = await createAdapter(fetchImpl).requestQuestion(
      CONTEXT,
      new AbortController().signal,
      IDENTITY,
    );

    expect(result.kind).toBe("question");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("Modal-Key")).toBe("token-id");
    expect(new Headers(init?.headers).get("Modal-Secret")).toBe(
      "token-secret",
    );
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/json",
    );

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual([
      "kind",
      "context",
      "session_hash",
      "ip_hash",
    ]);
    expect(body).toEqual({
      kind: "question",
      context: CONTEXT,
      session_hash: IDENTITY.sessionHash,
      ip_hash: IDENTITY.ipHash,
    });
  });

  it.each([429, 503])("HTTP %s는 한 번만 재시도한다", async (status) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(
        responseText({ version: "1", kind: "complete" }),
      );

    const result = await createAdapter(fetchImpl).requestQuestion(
      CONTEXT,
      new AbortController().signal,
      IDENTITY,
    );

    expect(result).toEqual({ version: "1", kind: "complete" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("일시적인 transport 오류는 한 번만 재시도한다", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("temporary network detail"))
      .mockResolvedValueOnce(
        responseText({ version: "1", kind: "complete" }),
      );

    const result = await createAdapter(fetchImpl).requestQuestion(
      CONTEXT,
      new AbortController().signal,
      IDENTITY,
    );

    expect(result).toEqual({ version: "1", kind: "complete" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])("HTTP %s는 재시도하지 않는다", async (status) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("credential detail", { status }));

    const error = await createAdapter(fetchImpl)
      .requestQuestion(
        CONTEXT,
        new AbortController().signal,
        IDENTITY,
      )
      .catch((caught: unknown) => caught);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(MedGemmaProviderError);
    expect(error).toEqual(
      expect.objectContaining({ code: "provider-unavailable" }),
    );
    expect(String(error)).not.toContain("credential detail");
    expect(String(error)).not.toContain("token-secret");
  });

  it.each([
    ["JSON", "not-json"],
    [
      "schema",
      JSON.stringify({ version: "1", kind: "question", unknown: true }),
    ],
  ])("모델 text의 %s가 잘못되면 재시도하지 않는다", async (_, text) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ text }));

    const error = await createAdapter(fetchImpl)
      .requestQuestion(
        CONTEXT,
        new AbortController().signal,
        IDENTITY,
      )
      .catch((caught: unknown) => caught);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error).toEqual(
      expect.objectContaining({ code: "invalid-provider-response" }),
    );
    expect(String(error)).not.toContain("not-json");
  });

  it("60초가 지나면 진행 중인 요청을 중단한다", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>((_, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    const request = createAdapter(fetchImpl).requestQuestion(
      CONTEXT,
      new AbortController().signal,
      IDENTITY,
    );
    const rejection = expect(request).rejects.toEqual(
      expect.objectContaining({ code: "provider-timeout" }),
    );

    await vi.advanceTimersByTimeAsync(60_000);

    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("허용되지 않은 mode와 비활성 actual 설정을 거절한다", () => {
    expect(() => createMedGemmaProvider({ MEDGEMMA_MODE: "vertex" })).toThrow(
      expect.objectContaining({ code: "invalid-provider-config" }),
    );
    expect(() =>
      createMedGemmaProvider({
        MEDGEMMA_MODE: "modal",
        MEDGEMMA_ACTUAL_DISABLED: "1",
      }),
    ).toThrow(expect.objectContaining({ code: "invalid-provider-config" }));
  });
});
