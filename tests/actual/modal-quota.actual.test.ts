import { createHash, randomUUID } from "node:crypto";

import { describe, it } from "vitest";

import type { AiInterviewContextV1 } from "@/lib/ai/contracts";

const ACTUAL_ENABLED = process.env.RUN_MEDGEMMA_ACTUAL === "1";
const QUOTA_URL_PRESENT = Boolean(process.env.MODAL_QUOTA_SMOKE_URL?.trim());
const QUOTA_ENABLED = ACTUAL_ENABLED && QUOTA_URL_PRESENT;
const TEST_TIMEOUT_MS = 120_000;

function requireSecretEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`quota-config-missing:${name}`);
  return value;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createContext(): AiInterviewContextV1 {
  return {
    version: "1",
    interviewId: "quota-synthetic-interview",
    personaId: "persona-kim",
    currentSlot: "chief-complaint",
    filledSlots: { "chief-complaint": "합성 역할극 두통" },
    recentTurns: [
      {
        id: "quota-turn-001",
        question: "어디가 불편하신가요?",
        answer: "합성 역할극 두통",
      },
    ],
  };
}

function assertStatus(actual: number, expected: number, code: string): void {
  if (actual !== expected) {
    throw new Error(`${code}:status-${actual}`);
  }
}

describe.skipIf(!QUOTA_ENABLED).sequential("Modal quota actual gate", () => {
  const runId = randomUUID();
  const url = () => requireSecretEnvironment("MODAL_QUOTA_SMOKE_URL");
  const authenticatedHeaders = () => ({
    "Content-Type": "application/json",
    "Modal-Key": requireSecretEnvironment("MODAL_PROXY_TOKEN_ID"),
    "Modal-Secret": requireSecretEnvironment("MODAL_PROXY_TOKEN_SECRET"),
  });

  async function reserve(sessionHash: string, ipHash: string): Promise<number> {
    const response = await fetch(url(), {
      method: "POST",
      headers: authenticatedHeaders(),
      body: JSON.stringify({
        kind: "question",
        context: createContext(),
        session_hash: sessionHash,
        ip_hash: ipHash,
      }),
      cache: "no-store",
    });
    return response.status;
  }

  it(
    "무인증 요청을 401로 거절한다",
    async () => {
      const response = await fetch(url(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "question",
          context: createContext(),
          session_hash: hash(`${runId}-unauth-session`),
          ip_hash: hash(`${runId}-unauth-ip`),
        }),
        cache: "no-store",
      });
      assertStatus(response.status, 401, "quota-unauthenticated");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "동일 session의 6번째 요청을 429로 거절한다",
    async () => {
      const sessionHash = hash(`${runId}-session-limit`);
      const ipHash = hash(`${runId}-session-ip`);
      for (let index = 1; index <= 6; index += 1) {
        const status = await reserve(sessionHash, ipHash);
        assertStatus(
          status,
          index === 6 ? 429 : 200,
          `quota-session-${index}`,
        );
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "동일 IP의 21번째 요청을 429로 거절한다",
    async () => {
      const ipHash = hash(`${runId}-ip-limit`);
      for (let index = 1; index <= 21; index += 1) {
        const status = await reserve(
          hash(`${runId}-ip-session-${index}`),
          ipHash,
        );
        assertStatus(status, index === 21 ? 429 : 200, `quota-ip-${index}`);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "전체 101번째 요청을 429로 거절한다",
    async () => {
      for (let index = 26; index <= 101; index += 1) {
        const status = await reserve(
          hash(`${runId}-daily-session-${index}`),
          hash(`${runId}-daily-ip-${index}`),
        );
        assertStatus(
          status,
          index === 101 ? 429 : 200,
          `quota-daily-${index}`,
        );
      }
    },
    TEST_TIMEOUT_MS,
  );
});
