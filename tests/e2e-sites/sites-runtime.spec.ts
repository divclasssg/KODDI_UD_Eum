import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const SITES_ORIGIN = "http://127.0.0.1:4173";
const PUBLIC_CONTEXT = {
  version: "2",
  interviewId: "sites-runtime-smoke-001",
  currentSlot: "chief-complaint",
  filledSlots: {},
  recentTurns: [
    {
      id: "sites-turn-001",
      question: "어디가 불편하신가요?",
      answer: "무릎이 이틀 전부터 불편해요.",
    },
  ],
};

test("Cloudflare preview가 mock AI 질문과 요약 route를 제공한다", async ({
  request,
}) => {
  const headers = { Origin: SITES_ORIGIN };
  const questionResponse = await request.post("/api/ai/question", {
    data: { ...PUBLIC_CONTEXT, recentTurns: [] },
    headers,
  });

  expect(questionResponse.status()).toBe(200);
  await expect(questionResponse.json()).resolves.toMatchObject({
    version: "2",
    kind: "question",
    question: {
      slot: "chief-complaint",
      text: "어디가 불편하신가요?",
    },
  });

  const summaryResponse = await request.post("/api/ai/summary", {
    data: PUBLIC_CONTEXT,
    headers,
  });

  expect(summaryResponse.status()).toBe(200);
  await expect(summaryResponse.json()).resolves.toEqual({
    version: "2",
    kind: "summary",
    summary: {
      subjective: [
        {
          id: "subjective-sites-turn-001",
          text: "무릎이 이틀 전부터 불편해요.",
          evidenceTurnIds: ["sites-turn-001"],
        },
      ],
      objective: [],
      verificationNeeded: [],
    },
  });
});

test("Sites 산출물에 project_id 호스팅 설정이 포함된다", async () => {
  const sourcePath = resolve(".openai", "hosting.json");
  const outputPath = resolve("dist", ".openai", "hosting.json");
  const [source, output] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(outputPath, "utf8"),
  ]);
  const sourceConfig = JSON.parse(source) as { project_id?: unknown };
  const outputConfig = JSON.parse(output) as { project_id?: unknown };

  expect(sourceConfig.project_id).toEqual(expect.any(String));
  expect(sourceConfig.project_id).not.toBe("");
  expect(outputConfig).toEqual(sourceConfig);
});
