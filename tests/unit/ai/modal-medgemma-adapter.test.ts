import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiInterviewContextV1 } from "@/lib/ai/contracts";
import {
  MedGemmaProviderError,
  createModalMedGemmaAdapter,
} from "@/lib/ai/modal-medgemma-adapter";
import {
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
