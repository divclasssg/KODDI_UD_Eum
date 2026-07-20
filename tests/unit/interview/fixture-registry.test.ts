import { describe, expect, it } from "vitest";

import { INTERVIEW_FIXTURES } from "@/features/interview/fixtures/fixture-registry";
import { INTERVIEW_FIXTURE_IDS } from "@/features/interview/fixtures/fixture.types";
import { resolveFixtureId } from "@/features/interview/fixtures/resolve-fixture";

describe("fixture ID 해석", () => {
  it("서버 flag가 없으면 query를 거절한다", () => {
    expect(resolveFixtureId("save-error", false)).toEqual({ ok: false });
  });

  it("allowlist ID만 허용한다", () => {
    expect(resolveFixtureId("save-error", true)).toEqual({
      ok: true,
      id: "save-error",
    });
    expect(resolveFixtureId("../../secret", true)).toEqual({ ok: false });
    expect(resolveFixtureId(["save-error"], true)).toEqual({ ok: false });
  });
});

describe("문진 fixture registry", () => {
  it("승인된 9개 ID를 빠짐없이 한 번씩 정의한다", () => {
    expect(INTERVIEW_FIXTURE_IDS).toHaveLength(9);
    expect(Object.keys(INTERVIEW_FIXTURES)).toEqual(INTERVIEW_FIXTURE_IDS);

    for (const id of INTERVIEW_FIXTURE_IDS) {
      expect(INTERVIEW_FIXTURES[id].id).toBe(id);
    }
  });

  it.each([
    ["answering-default", "question", undefined, "off", false, false, ["submit"]],
    ["history-review", "question", undefined, "off", false, false, ["submit", "jump-to-latest"]],
    ["saving-delayed", "status", "status", "polite", true, true, []],
    ["waiting-for-ai", "status", "status", "polite", true, true, []],
    ["save-error", "error", "alert", "assertive", false, false, ["retry-save"]],
    ["ai-error", "error", "alert", "assertive", false, false, ["retry-ai", "continue-manually"]],
    ["safety-caution", "safety", "status", "polite", false, false, ["continue-interview"]],
    ["safety-urgent", "safety", "alert", "assertive", false, true, ["call-119", "show-to-bystander", "view-summary"]],
    ["summary-transition", "status", "status", "polite", true, true, []],
  ] as const)(
    "%s의 전체 접근성 계약을 고정한다",
    (id, focus, role, live, busy, inputLocked, actions) => {
      const expected = {
        focus,
        live,
        busy,
        inputLocked,
        actions,
        ...(role ? { role } : {}),
      };
      expect(INTERVIEW_FIXTURES[id].expected).toEqual(expected);
    },
  );

  it("과거 대화 fixture만 확정 turn 5개를 제공한다", () => {
    expect(INTERVIEW_FIXTURES["history-review"].model.history).toHaveLength(5);
    expect(INTERVIEW_FIXTURES["answering-default"].model.history).toHaveLength(2);
  });

  it("질문 번호와 실제 식별정보 필드를 포함하지 않는다", () => {
    const forbiddenKeys = new Set([
      "questionNumber",
      "questionCount",
      "step",
      "progress",
      "name",
      "birthDate",
      "phone",
      "email",
      "address",
      "patientId",
    ]);

    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (value === null || typeof value !== "object") return;

      for (const [key, nested] of Object.entries(value)) {
        expect(forbiddenKeys.has(key), `금지된 필드: ${key}`).toBe(false);
        visit(nested);
      }
    };

    visit(INTERVIEW_FIXTURES);
  });
});
