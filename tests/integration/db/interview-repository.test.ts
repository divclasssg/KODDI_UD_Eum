import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import { PUBLIC_AI_COMPLETION_MARKER } from "@/features/interview/ai/ai-interview-service";
import { createManualInterviewService } from "@/features/interview/manual/manual-interview-service";
import { MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";

import {
  toUtcTimestamp,
  type InterviewAggregateV1,
  type RevisionToken,
} from "@/lib/db/contracts";
import {
  openMedicalInterviewDatabase,
  requestResult,
  transactionComplete,
} from "@/lib/db/database";
import {
  ConsentRequiredError,
  DatabaseCorruptionError,
  ImmutableInterviewError,
  RevisionConflictError,
} from "@/lib/db/errors";
import { createConsentRepository } from "@/lib/db/consent-repository";
import { createInterviewRepository } from "@/lib/db/interview-repository";
import { createProfileRepository } from "@/lib/db/profile-repository";

import {
  SYNTHETIC_AI_INTERVIEW_V2_INPUT,
  SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
  SYNTHETIC_DEFAULT_TEXT_SWITCH_QUESTION_V2,
  SYNTHETIC_FINAL_PROGRESS_INPUT,
  SYNTHETIC_GENERATED_QUESTION_V2,
  SYNTHETIC_INTERVIEW_INPUT,
  SYNTHETIC_INTERVIEW_V2_INPUT,
  SYNTHETIC_PROFILE_BUNDLE_INPUT,
  SYNTHETIC_PROGRESS_INPUT,
  SYNTHETIC_SAFETY_REVIEW_INPUT,
  SYNTHETIC_SUMMARY_INPUT,
} from "./fixtures";

function token(aggregate: InterviewAggregateV1): RevisionToken {
  return {
    interviewId: aggregate.interview.id,
    expectedRevision: aggregate.interview.revision,
    runtimeGeneration: 0,
  };
}

async function readRawAggregate(database: IDBDatabase, interviewId: string) {
  const transaction = database.transaction(
    ["interviews", "interviewDrafts", "messages", "summaries"],
    "readonly",
  );
  const [interview, draft, messages, summary] = await Promise.all([
    requestResult(transaction.objectStore("interviews").get(interviewId)),
    requestResult(transaction.objectStore("interviewDrafts").get(interviewId)),
    requestResult(
      transaction.objectStore("messages").index("byInterviewId").getAll(
        interviewId,
      ),
    ),
    requestResult(transaction.objectStore("summaries").get(interviewId)),
  ]);
  await transactionComplete(transaction);
  return {
    interview,
    draft,
    messages: messages.sort((left, right) => left.sequence - right.sequence),
    summary,
  };
}

describe("Interview repository", () => {
  let database: IDBDatabase;

  beforeEach(async () => {
    database = await openMedicalInterviewDatabase();
    await createConsentRepository(database).grant(
      SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
    );
    await createProfileRepository(database).saveBundle(
      SYNTHETIC_PROFILE_BUNDLE_INPUT,
    );
  });

  it("draft와 commit history를 같은 snapshot으로 복원한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
    const saved = await repository.saveProgress(
      token(created),
      SYNTHETIC_PROGRESS_INPUT,
    );

    const restored = await repository.loadInProgress(saved.interview.id);

    expect(restored?.draft).toEqual(saved.draft);
    expect(restored?.messages.map(({ sequence }) => sequence)).toEqual([0, 1]);
    expect(restored?.interview.revision).toBe(2);

    database.close();
  });

  it("database version 1에서 immutable 질문 snapshot과 V2 draft를 생성한다", async () => {
    const repository = createInterviewRepository(database);

    const created = await repository.create(SYNTHETIC_INTERVIEW_V2_INPUT);

    expect(database.version).toBe(1);
    expect(created.interview).toMatchObject({
      schemaVersion: 2,
      questionSetSnapshot: SYNTHETIC_INTERVIEW_V2_INPUT.questionSetSnapshot,
    });
    expect(created.draft).toMatchObject({
      schemaVersion: 2,
      input: { commonDraft: { contractVersion: 2 } },
    });

    database.close();
  });

  it("동시 AI find-or-create는 active draft 하나만 원자 생성한다", async () => {
    const secondDatabase = await openMedicalInterviewDatabase();
    const firstRepository = createInterviewRepository(database);
    const secondRepository = createInterviewRepository(secondDatabase);

    expect(firstRepository).toHaveProperty("findOrCreateAi");
    if (
      !("findOrCreateAi" in firstRepository) ||
      !("findOrCreateAi" in secondRepository) ||
      typeof firstRepository.findOrCreateAi !== "function" ||
      typeof secondRepository.findOrCreateAi !== "function"
    ) {
      secondDatabase.close();
      database.close();
      return;
    }

    const [first, second] = await Promise.all([
      firstRepository.findOrCreateAi({
        ...SYNTHETIC_AI_INTERVIEW_V2_INPUT,
        id: "concurrent-ai-first",
      }),
      secondRepository.findOrCreateAi({
        ...SYNTHETIC_AI_INTERVIEW_V2_INPUT,
        id: "concurrent-ai-second",
      }),
    ]);
    const transaction = database.transaction(
      ["interviews", "interviewDrafts"],
      "readonly",
    );
    const [interviews, drafts] = await Promise.all([
      requestResult(transaction.objectStore("interviews").getAll()),
      requestResult(transaction.objectStore("interviewDrafts").getAll()),
    ]);
    await transactionComplete(transaction);
    const activeAiInterviews = interviews.filter(
      (interview) =>
        interview.mode === "ai" &&
        (interview.status === "draft" || interview.status === "review"),
    );
    const activeIds = new Set(activeAiInterviews.map(({ id }) => id));
    const hiddenDrafts = drafts.filter(
      ({ interviewId }) => !activeIds.has(interviewId),
    );

    expect(first.interview.id).toBe(second.interview.id);
    expect(activeAiInterviews).toHaveLength(1);
    expect(drafts).toHaveLength(1);
    expect(hiddenDrafts).toHaveLength(0);
    expect(database.version).toBe(1);
    expect([...database.objectStoreNames]).toHaveLength(8);

    secondDatabase.close();
    database.close();
  });

  it("V1 진행 draft를 첫 명시적 upgrade transaction에서 V2로 올린다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create({
      ...SYNTHETIC_INTERVIEW_INPUT,
      id: "legacy-manual-v1",
      draft: {
        currentQuestion: SYNTHETIC_INTERVIEW_V2_INPUT.draft.currentQuestion,
        input: { mode: "text", text: "", selectedOptionIds: [] },
        updatedAt: SYNTHETIC_INTERVIEW_INPUT.draft.updatedAt,
      },
    });
    const commonDraft = structuredClone(
      SYNTHETIC_INTERVIEW_V2_INPUT.draft.input.commonDraft,
    );
    commonDraft.values.text.value = "합성 legacy 복원 입력";

    const upgraded = await repository.upgradeLegacyDraft(token(created), {
      questionSetSnapshot: SYNTHETIC_INTERVIEW_V2_INPUT.questionSetSnapshot,
      commonDraft,
      updatedAt: toUtcTimestamp("2026-07-22T01:00:05.000Z"),
    });

    expect(database.version).toBe(1);
    expect(upgraded.interview).toMatchObject({
      schemaVersion: 2,
      revision: 2,
      questionSetSnapshot: SYNTHETIC_INTERVIEW_V2_INPUT.questionSetSnapshot,
    });
    expect(upgraded.draft?.schemaVersion).toBe(2);

    database.close();
  });

  it("draft persist가 interview와 draft revision만 함께 증가시킨다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_V2_INPUT);
    const commonDraft = structuredClone(
      SYNTHETIC_INTERVIEW_V2_INPUT.draft.input.commonDraft,
    );
    commonDraft.values.text.value = "합성 저장 전 초안";

    const saved = await repository.persistDraft(token(created), {
      commonDraft,
      updatedAt: toUtcTimestamp("2026-07-22T01:00:10.000Z"),
    });

    expect(saved.interview.revision).toBe(2);
    expect(saved.draft?.revision).toBe(2);
    expect(saved.draft?.schemaVersion).toBe(2);
    if (saved.draft?.schemaVersion !== 2) throw new Error("expected-v2-draft");
    expect(saved.draft.input.commonDraft).toEqual(commonDraft);
    expect(saved.messages).toEqual([]);

    database.close();
  });

  it("V2 answer 저장 뒤 다음 질문의 common draft와 질문 snapshot을 유지한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_V2_INPUT);
    const nextQuestion = SYNTHETIC_INTERVIEW_V2_INPUT.questionSetSnapshot.questions[1];
    const nextCommonDraft = createEmptyDraft(nextQuestion);

    const saved = await repository.saveProgress(token(created), {
      ...SYNTHETIC_PROGRESS_INPUT,
      draft: {
        currentQuestion: {
          id: nextQuestion.id,
          slot: nextQuestion.slot,
          text: nextQuestion.text,
          selection: "single",
          options: nextQuestion.contracts.chip?.options ?? [],
        },
        input: {
          mode: "choice",
          text: "",
          selectedOptionIds: [],
          commonDraft: nextCommonDraft,
        },
        updatedAt: SYNTHETIC_PROGRESS_INPUT.draft.updatedAt,
      },
    });

    expect(saved.interview.schemaVersion).toBe(2);
    expect(saved.interview).toMatchObject({
      questionSetSnapshot: SYNTHETIC_INTERVIEW_V2_INPUT.questionSetSnapshot,
    });
    expect(saved.draft?.schemaVersion).toBe(2);
    if (saved.draft?.schemaVersion !== 2) throw new Error("expected-v2-draft");
    expect(saved.draft.input.commonDraft).toEqual(nextCommonDraft);

    database.close();
  });

  it("생성 질문을 V2 snapshot 끝에 추가하고 빈 draft로 원자 전환한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const originalSnapshot = structuredClone(created.interview);
    const generatedQuestion = structuredClone(SYNTHETIC_GENERATED_QUESTION_V2);

    const saved = await repository.saveGeneratedQuestion(token(created), {
      question: generatedQuestion,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    });
    generatedQuestion.text = "저장 뒤 변경된 문구";
    const restored = await repository.loadInProgress(created.interview.id);

    expect(database.version).toBe(1);
    expect([...database.objectStoreNames]).toHaveLength(8);
    expect(saved.interview.schemaVersion).toBe(2);
    if (saved.interview.schemaVersion !== 2) {
      throw new Error("expected-v2-interview");
    }
    expect(saved.interview.questionSetSnapshot.questions.at(-1)?.id)
      .toBe("ai-question-002");
    expect(saved.interview.questionSetSnapshot.questions.slice(0, -1))
      .toEqual(SYNTHETIC_AI_INTERVIEW_V2_INPUT.questionSetSnapshot.questions);
    expect(created.interview).toEqual(originalSnapshot);
    expect(saved.draft?.currentQuestion.id).toBe("ai-question-002");
    expect(restored?.interview).toEqual(saved.interview);
    expect(saved.draft).toMatchObject({
      schemaVersion: 2,
      revision: 2,
      input: {
        mode: "choice",
        text: "",
        selectedOptionIds: [],
        commonDraft: {
          contractVersion: 2,
          questionId: "ai-question-002",
          activeMode: "choice",
        },
      },
    });

    database.close();
  });

  it("답변 commit 뒤 current question과 마지막 Q/A를 같게 복원한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    if (created.draft?.schemaVersion !== 2) throw new Error("expected-v2-draft");
    const answerCommitted = await repository.saveProgress(token(created), {
      draft: {
        currentQuestion: structuredClone(created.draft.currentQuestion),
        input: structuredClone(created.draft.input),
        updatedAt: toUtcTimestamp("2026-07-22T01:00:30.000Z"),
      },
      appendedMessages: SYNTHETIC_SAFETY_REVIEW_INPUT.appendedMessages
        .slice(0, 2),
    });

    const restored = await repository.loadInProgress(created.interview.id);

    expect(restored).toEqual(answerCommitted);
    expect(restored?.draft?.currentQuestion.text)
      .toBe(restored?.messages.at(-2)?.text);
    expect(restored?.messages.slice(-2).map(({ role, kind }) => ({ role, kind })))
      .toEqual([
        { role: "assistant", kind: "question" },
        { role: "user", kind: "answer" },
      ]);

    database.close();
  });

  it("provider complete marker를 기존 message store에 원자 저장한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    if (created.draft?.schemaVersion !== 2) throw new Error("expected-v2-draft");
    const answerCommitted = await repository.saveProgress(token(created), {
      draft: {
        currentQuestion: structuredClone(created.draft.currentQuestion),
        input: structuredClone(created.draft.input),
        updatedAt: toUtcTimestamp("2026-07-22T01:00:30.000Z"),
      },
      appendedMessages: SYNTHETIC_SAFETY_REVIEW_INPUT.appendedMessages.slice(0, 2),
    });
    if (answerCommitted.draft?.schemaVersion !== 2) {
      throw new Error("expected-v2-draft");
    }

    const marked = await repository.saveProgress(token(answerCommitted), {
      draft: {
        currentQuestion: structuredClone(answerCommitted.draft.currentQuestion),
        input: structuredClone(answerCommitted.draft.input),
        updatedAt: toUtcTimestamp("2026-07-22T01:00:31.000Z"),
      },
      appendedMessages: [{
        id: "message-completion-002",
        sequence: 2,
        role: "system",
        kind: "completion",
        text: PUBLIC_AI_COMPLETION_MARKER,
        createdAt: toUtcTimestamp("2026-07-22T01:00:31.000Z"),
      }],
    });
    const restored = await repository.loadInProgress(created.interview.id);

    expect(database.version).toBe(1);
    expect([...database.objectStoreNames]).toHaveLength(8);
    expect(restored).toEqual(marked);
    expect(restored?.messages.at(-1)).toMatchObject({
      schemaVersion: 1,
      sequence: 2,
      role: "system",
      kind: "completion",
      text: PUBLIC_AI_COMPLETION_MARKER,
    });

    database.close();
  });

  it("default text 질문을 chip으로 persist한 뒤 생성 질문을 저장한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const generated = await repository.saveGeneratedQuestion(token(created), {
      question: SYNTHETIC_DEFAULT_TEXT_SWITCH_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    });
    const switchedDraft = createEmptyDraft(
      SYNTHETIC_DEFAULT_TEXT_SWITCH_QUESTION_V2,
    );
    switchedDraft.activeMode = "chip";
    switchedDraft.values.chip.selectedOptionIds = ["mild"];
    const switched = await repository.persistDraft(token(generated), {
      commonDraft: switchedDraft,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:30.000Z"),
    });

    const saved = await repository.saveGeneratedQuestion(token(switched), {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:02:00.000Z"),
    });

    expect(switched.draft?.currentQuestion).toMatchObject({
      id: SYNTHETIC_DEFAULT_TEXT_SWITCH_QUESTION_V2.id,
      selection: "single",
      options: [],
    });
    expect(saved.draft?.currentQuestion.id).toBe(
      SYNTHETIC_GENERATED_QUESTION_V2.id,
    );

    database.close();
  });

  it("중복 생성 질문 ID와 stale revision을 거절하고 snapshot을 유지한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const duplicate = {
      ...SYNTHETIC_GENERATED_QUESTION_V2,
      id: "ai-question-001",
    };

    await expect(repository.saveGeneratedQuestion(token(created), {
      question: duplicate,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    })).rejects.toBeInstanceOf(DatabaseCorruptionError);
    await expect(repository.saveGeneratedQuestion({
      ...token(created),
      expectedRevision: 0,
    }, {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    })).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await repository.loadInProgress(created.interview.id)).toEqual(created);

    database.close();
  });

  it("생성 질문 저장은 exact runtime generation과 local consent를 요구한다", async () => {
    const repository = createInterviewRepository(database, {
      assertRuntimeGeneration(generation) {
        if (generation !== 7) throw new Error("stale-runtime-generation");
      },
    });
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const input = {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    };

    await expect(repository.saveGeneratedQuestion(token(created), input))
      .rejects.toThrow("stale-runtime-generation");
    await createConsentRepository(database).withdrawLocalStorage();
    await expect(repository.saveGeneratedQuestion({
      ...token(created),
      runtimeGeneration: 7,
    }, input)).rejects.toBeInstanceOf(ConsentRequiredError);

    database.close();
  });

  it("생성 질문 commit 뒤 동의 철회가 큐잉되어도 결과와 durable 상태가 같다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);

    const saving = repository.saveGeneratedQuestion(token(created), {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    });
    const withdrawing = createConsentRepository(database).withdrawLocalStorage();
    const [saved] = await Promise.all([saving, withdrawing]);

    expect(await readRawAggregate(database, created.interview.id)).toEqual(saved);

    database.close();
  });

  it("안전 review commit 뒤 동의 철회가 큐잉되어도 결과와 durable 상태가 같다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);

    const saving = repository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );
    const withdrawing = createConsentRepository(database).withdrawLocalStorage();
    const [saved] = await Promise.all([saving, withdrawing]);

    expect(await readRawAggregate(database, created.interview.id)).toEqual(saved);

    database.close();
  });

  it("생성 질문 입력을 호출 직후 바꿔도 최초 snapshot만 저장한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const input = {
      question: structuredClone(SYNTHETIC_GENERATED_QUESTION_V2),
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    };

    const saving = repository.saveGeneratedQuestion(token(created), input);
    input.question.text = "호출 직후 변경된 생성 질문";
    input.updatedAt = toUtcTimestamp("2026-07-22T02:00:00.000Z");
    const saved = await saving;

    expect(saved.interview.updatedAt).toBe("2026-07-22T01:01:00.000Z");
    expect(saved.draft?.currentQuestion.text)
      .toBe(SYNTHETIC_GENERATED_QUESTION_V2.text);

    database.close();
  });

  it("안전 review 입력을 호출 직후 바꿔도 최초 snapshot만 저장한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const input = structuredClone(SYNTHETIC_SAFETY_REVIEW_INPUT);

    const saving = repository.saveSafetyReview(token(created), input);
    input.appendedMessages[1].text = "호출 직후 변경된 답변";
    input.appendedMessages[2].text = "호출 직후 변경된 안전 문구";
    input.updatedAt = toUtcTimestamp("2026-07-22T02:00:00.000Z");
    const saved = await saving;

    expect(saved.interview.updatedAt)
      .toBe(SYNTHETIC_SAFETY_REVIEW_INPUT.updatedAt);
    expect(saved.messages.at(-2)?.text)
      .toBe(SYNTHETIC_SAFETY_REVIEW_INPUT.appendedMessages[1].text);
    expect(saved.messages.at(-1)?.text)
      .toBe(SYNTHETIC_SAFETY_REVIEW_INPUT.appendedMessages[2].text);

    database.close();
  });

  it("생성 질문은 async read 중 runtime generation이 바뀌면 mutation 전에 거절한다", async () => {
    let runtimeGeneration = 0;
    const repository = createInterviewRepository(database, {
      assertRuntimeGeneration(generation) {
        if (generation !== runtimeGeneration) {
          throw new Error("stale-runtime-generation");
        }
      },
    });
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const before = await readRawAggregate(database, created.interview.id);

    const saving = repository.saveGeneratedQuestion(token(created), {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    });
    runtimeGeneration = 1;

    await expect(saving).rejects.toThrow("stale-runtime-generation");
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("생성 질문 final put 직전 signal abort는 aggregate 전체를 되돌린다", async () => {
    const controller = new AbortController();
    const repository = createInterviewRepository(database, {
      beforeFinalPut(storeName) {
        if (storeName === "interviews") controller.abort();
      },
    });
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const before = await readRawAggregate(database, created.interview.id);

    await expect(repository.saveGeneratedQuestion(token(created), {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("progress final put 직전 signal abort는 aggregate 전체를 되돌린다", async () => {
    const controller = new AbortController();
    const repository = createInterviewRepository(database, {
      beforeFinalPut(storeName) {
        if (storeName === "interviews") controller.abort();
      },
    });
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const before = await readRawAggregate(database, created.interview.id);

    await expect(repository.saveProgress(token(created), {
      draft: structuredClone(SYNTHETIC_AI_INTERVIEW_V2_INPUT.draft),
      appendedMessages: [],
    }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("summary final put 직전 signal abort는 aggregate 전체를 되돌린다", async () => {
    const originalRepository = createInterviewRepository(database);
    const created = await originalRepository.create(SYNTHETIC_INTERVIEW_INPUT);
    const progressed = await originalRepository.saveProgress(
      token(created),
      SYNTHETIC_PROGRESS_INPUT,
    );
    const before = await readRawAggregate(database, created.interview.id);
    const controller = new AbortController();
    const repository = createInterviewRepository(database, {
      beforeFinalPut(storeName) {
        if (storeName === "interviews") controller.abort();
      },
    });

    await expect(repository.saveSummary(
      token(progressed),
      SYNTHETIC_SUMMARY_INPUT,
      controller.signal,
    )).rejects.toMatchObject({ name: "AbortError" });
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("안전 review는 async read 중 runtime generation이 바뀌면 mutation 전에 거절한다", async () => {
    let runtimeGeneration = 0;
    const repository = createInterviewRepository(database, {
      assertRuntimeGeneration(generation) {
        if (generation !== runtimeGeneration) {
          throw new Error("stale-runtime-generation");
        }
      },
    });
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const before = await readRawAggregate(database, created.interview.id);

    const saving = repository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );
    runtimeGeneration = 1;

    await expect(saving).rejects.toThrow("stale-runtime-generation");
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("안전 종료는 async read 중 runtime generation이 바뀌면 mutation 전에 거절한다", async () => {
    const setupRepository = createInterviewRepository(database);
    const created = await setupRepository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const reviewed = await setupRepository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );
    let runtimeGeneration = 0;
    const repository = createInterviewRepository(database, {
      assertRuntimeGeneration(generation) {
        if (generation !== runtimeGeneration) {
          throw new Error("stale-runtime-generation");
        }
      },
    });
    const before = await readRawAggregate(database, created.interview.id);

    const stopping = repository.confirmSafetyStop(token(reviewed), "call-119");
    runtimeGeneration = 1;

    await expect(stopping).rejects.toThrow("stale-runtime-generation");
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("생성 질문은 기존 message sequence gap을 발견하면 원본을 그대로 둔다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const corruption = database.transaction("messages", "readwrite");
    corruption.objectStore("messages").add({
      interviewId: created.interview.id,
      schemaVersion: 1,
      id: "raw-gap-message",
      sequence: 4,
      role: "user",
      kind: "answer",
      text: "합성 sequence gap",
      createdAt: SYNTHETIC_SAFETY_REVIEW_INPUT.updatedAt,
    });
    await transactionComplete(corruption);
    const before = await readRawAggregate(database, created.interview.id);

    await expect(repository.saveGeneratedQuestion(token(created), {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    })).rejects.toBeInstanceOf(DatabaseCorruptionError);
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("안전 review는 draft와 question snapshot 불일치를 발견하면 원본을 그대로 둔다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const corruption = database.transaction("interviewDrafts", "readwrite");
    corruption.objectStore("interviewDrafts").put({
      ...created.draft,
      currentQuestion: {
        ...created.draft?.currentQuestion,
        slot: "raw-corrupted-slot",
      },
    });
    await transactionComplete(corruption);
    const before = await readRawAggregate(database, created.interview.id);

    await expect(repository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    )).rejects.toBeInstanceOf(DatabaseCorruptionError);
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("안전 종료는 common draft와 question snapshot 불일치를 발견하면 원본을 그대로 둔다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const reviewed = await repository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );
    if (reviewed.draft?.schemaVersion !== 2) throw new Error("expected-v2-draft");
    const corruption = database.transaction("interviewDrafts", "readwrite");
    corruption.objectStore("interviewDrafts").put({
      ...reviewed.draft,
      input: {
        ...reviewed.draft.input,
        commonDraft: {
          ...reviewed.draft.input.commonDraft,
          allowedModes: ["choice"],
        },
      },
    });
    await transactionComplete(corruption);
    const before = await readRawAggregate(database, created.interview.id);

    await expect(repository.confirmSafetyStop(token(reviewed), "call-119"))
      .rejects.toBeInstanceOf(DatabaseCorruptionError);
    expect(await readRawAggregate(database, created.interview.id)).toEqual(before);

    database.close();
  });

  it("생성 질문 transaction 중간 실패 시 aggregate 전체를 되돌린다", async () => {
    const originalRepository = createInterviewRepository(database);
    const created = await originalRepository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const failingRepository = createInterviewRepository(database, {
      beforeFinalPut(storeName) {
        if (storeName === "interviewDrafts") {
          throw new Error("합성 생성 질문 실패");
        }
      },
    });

    await expect(failingRepository.saveGeneratedQuestion(token(created), {
      question: SYNTHETIC_GENERATED_QUESTION_V2,
      updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
    })).rejects.toThrow("합성 생성 질문 실패");
    expect(await originalRepository.loadInProgress(created.interview.id))
      .toEqual(created);

    database.close();
  });

  it("위험 Q/A와 safety message를 append하고 draft를 복원 가능하게 보존한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);

    const reviewed = await repository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );
    const restored = await repository.loadInProgress(created.interview.id);

    expect(reviewed.interview).toMatchObject({ status: "draft", revision: 2 });
    expect(reviewed.draft).toEqual({
      ...created.draft,
      revision: 2,
      updatedAt: SYNTHETIC_SAFETY_REVIEW_INPUT.updatedAt,
    });
    expect(reviewed.messages.map(({ role, kind, sequence }) => ({
      role,
      kind,
      sequence,
    }))).toEqual([
      { role: "assistant", kind: "question", sequence: 0 },
      { role: "user", kind: "answer", sequence: 1 },
      { role: "system", kind: "safety", sequence: 2 },
    ]);
    expect(restored).toEqual(reviewed);

    database.close();
  });

  it("위험 review의 메시지 순서와 Q/A/safety 형태가 정확하지 않으면 거절한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const invalid = structuredClone(SYNTHETIC_SAFETY_REVIEW_INPUT);
    invalid.appendedMessages[2].sequence = 4;
    invalid.appendedMessages[2].kind = "answer";

    await expect(repository.saveSafetyReview(token(created), invalid))
      .rejects.toBeInstanceOf(DatabaseCorruptionError);
    expect(await repository.loadInProgress(created.interview.id)).toEqual(created);

    database.close();
  });

  it("위험 review transaction 중간 실패 시 aggregate 전체를 되돌린다", async () => {
    const originalRepository = createInterviewRepository(database);
    const created = await originalRepository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const failingRepository = createInterviewRepository(database, {
      beforeFinalPut(storeName) {
        if (storeName === "messages") throw new Error("합성 안전 review 실패");
      },
    });

    await expect(failingRepository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    )).rejects.toThrow("합성 안전 review 실패");
    expect(await originalRepository.loadInProgress(created.interview.id))
      .toEqual(created);

    database.close();
  });

  it("허용된 안전 행동 확인 뒤 terminal로 저장하고 draft를 삭제한다", async () => {
    const stoppedAt = toUtcTimestamp("2026-07-22T01:02:00.000Z");
    const repository = createInterviewRepository(database, { now: () => stoppedAt });
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const reviewed = await repository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );

    const stopped = await repository.confirmSafetyStop(
      token(reviewed),
      "call-119",
    );
    const storedTransaction = database.transaction(
      ["interviews", "interviewDrafts"],
      "readonly",
    );
    const [storedInterview, storedDraft] = await Promise.all([
      requestResult(storedTransaction.objectStore("interviews").get(
        created.interview.id,
      )),
      requestResult(storedTransaction.objectStore("interviewDrafts").get(
        created.interview.id,
      )),
    ]);

    expect(stopped.interview).toMatchObject({
      status: "safety-stopped",
      revision: 3,
      updatedAt: stoppedAt,
      safetyStopAction: "call-119",
    });
    expect(stopped.draft).toBeUndefined();
    expect(stopped.messages).toEqual(reviewed.messages);
    expect(storedInterview).toEqual(stopped.interview);
    expect(storedDraft).toBeUndefined();
    expect(await repository.loadInProgress(created.interview.id)).toBeUndefined();
    await expect(repository.confirmSafetyStop(token(stopped), "view-summary"))
      .rejects.toBeInstanceOf(ImmutableInterviewError);

    database.close();
  });

  it("safety message 전이거나 허용되지 않은 행동이면 안전 종료하지 않는다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);

    await expect(repository.confirmSafetyStop(token(created), "call-119"))
      .rejects.toBeInstanceOf(DatabaseCorruptionError);
    const reviewed = await repository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );
    await expect(repository.confirmSafetyStop(
      token(reviewed),
      "unsafe-action" as "call-119",
    )).rejects.toBeInstanceOf(DatabaseCorruptionError);
    expect(await repository.loadInProgress(created.interview.id)).toEqual(reviewed);

    database.close();
  });

  it("안전 종료 transaction 중간 실패 시 review aggregate를 복원한다", async () => {
    const originalRepository = createInterviewRepository(database);
    const created = await originalRepository.create(SYNTHETIC_AI_INTERVIEW_V2_INPUT);
    const reviewed = await originalRepository.saveSafetyReview(
      token(created),
      SYNTHETIC_SAFETY_REVIEW_INPUT,
    );
    const failingRepository = createInterviewRepository(database, {
      beforeFinalPut(storeName) {
        if (storeName === "interviewDrafts") throw new Error("합성 안전 종료 실패");
      },
    });

    await expect(failingRepository.confirmSafetyStop(
      token(reviewed),
      "show-to-bystander",
    )).rejects.toThrow("합성 안전 종료 실패");
    expect(await originalRepository.loadInProgress(created.interview.id))
      .toEqual(reviewed);

    database.close();
  });

  it("동일 revision의 concurrent draft persist는 하나만 commit한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_V2_INPUT);
    const firstDraft = structuredClone(
      SYNTHETIC_INTERVIEW_V2_INPUT.draft.input.commonDraft,
    );
    firstDraft.values.text.value = "합성 첫 초안";
    const secondDraft = structuredClone(firstDraft);
    secondDraft.values.text.value = "합성 둘째 초안";

    const results = await Promise.allSettled([
      repository.persistDraft(token(created), {
        commonDraft: firstDraft,
        updatedAt: toUtcTimestamp("2026-07-22T01:00:10.000Z"),
      }),
      repository.persistDraft(token(created), {
        commonDraft: secondDraft,
        updatedAt: toUtcTimestamp("2026-07-22T01:00:11.000Z"),
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(
      results.find(({ status }) => status === "rejected"),
    ).toMatchObject({ reason: expect.any(RevisionConflictError) });

    database.close();
  });

  it("가장 최근 manual draft 또는 review만 복원한다", async () => {
    const repository = createInterviewRepository(database);
    await repository.create({
      ...SYNTHETIC_INTERVIEW_INPUT,
      id: "manual-old",
    });
    await repository.create({
      ...SYNTHETIC_INTERVIEW_INPUT,
      id: "ai-newer",
      mode: "ai",
      createdAt: toUtcTimestamp("2026-07-22T02:00:00.000Z"),
      draft: {
        ...SYNTHETIC_INTERVIEW_INPUT.draft,
        updatedAt: toUtcTimestamp("2026-07-22T02:00:00.000Z"),
      },
    });
    await repository.create({
      ...SYNTHETIC_INTERVIEW_INPUT,
      id: "manual-newest",
      createdAt: toUtcTimestamp("2026-07-22T03:00:00.000Z"),
      draft: {
        ...SYNTHETIC_INTERVIEW_INPUT.draft,
        updatedAt: toUtcTimestamp("2026-07-22T03:00:00.000Z"),
      },
    });

    expect((await repository.findLatestInProgress("manual"))?.interview.id)
      .toBe("manual-newest");
    expect((await repository.findLatestInProgress("ai"))?.interview.id)
      .toBe("ai-newer");

    database.close();
  });

  it("마지막 답변과 summary를 한 revision의 review로 저장한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);

    const reviewed = await repository.saveFinalProgress(
      token(created),
      SYNTHETIC_FINAL_PROGRESS_INPUT,
    );

    expect(reviewed.interview.status).toBe("review");
    expect(reviewed.interview.revision).toBe(2);
    expect(reviewed.draft?.revision).toBe(2);
    expect(reviewed.summary?.revision).toBe(2);
    expect(reviewed.messages).toHaveLength(2);

    database.close();
  });

  it("마지막 답변 transaction 실패 시 aggregate 전체를 유지한다", async () => {
    const originalRepository = createInterviewRepository(database);
    const created = await originalRepository.create(SYNTHETIC_INTERVIEW_INPUT);
    const failingRepository = createInterviewRepository(database, {
      beforeFinalPut(storeName) {
        if (storeName === "summaries") {
          throw new Error("합성 마지막 답변 실패");
        }
      },
    });

    await expect(
      failingRepository.saveFinalProgress(
        token(created),
        SYNTHETIC_FINAL_PROGRESS_INPUT,
      ),
    ).rejects.toThrow("합성 마지막 답변 실패");
    expect(await originalRepository.loadInProgress(created.interview.id))
      .toEqual(created);

    database.close();
  });

  it("마지막 답변 직전 동의 철회는 ConsentRequired로 거부한다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
    await createConsentRepository(database).withdrawLocalStorage();

    await expect(
      repository.saveFinalProgress(
        token(created),
        SYNTHETIC_FINAL_PROGRESS_INPUT,
      ),
    ).rejects.toBeInstanceOf(ConsentRequiredError);

    database.close();
  });

  it("stale revision은 원본 aggregate를 바꾸지 않는다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
    const staleToken = {
      ...token(created),
      expectedRevision: created.interview.revision - 1,
    };

    await expect(
      repository.saveProgress(staleToken, SYNTHETIC_PROGRESS_INPUT),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    expect(await repository.loadInProgress(created.interview.id)).toEqual(created);

    database.close();
  });

  it("summary review 뒤 draft로 돌아가도 revision을 연속 증가시킨다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
    const progressed = await repository.saveProgress(
      token(created),
      SYNTHETIC_PROGRESS_INPUT,
    );
    const reviewed = await repository.saveSummary(
      token(progressed),
      SYNTHETIC_SUMMARY_INPUT,
    );
    const returned = await repository.saveProgress(
      token(reviewed),
      { ...SYNTHETIC_PROGRESS_INPUT, appendedMessages: [] },
    );

    expect(reviewed.interview.status).toBe("review");
    expect(reviewed.summary?.status).toBe("review");
    expect(returned.interview.status).toBe("draft");
    expect(returned.interview.revision).toBe(4);
    expect(returned.draft?.revision).toBe(4);

    database.close();
  });

  it("현재 history에 없는 summary evidence ID를 저장하지 않는다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
    const progressed = await repository.saveProgress(
      token(created),
      SYNTHETIC_PROGRESS_INPUT,
    );

    await expect(
      repository.saveSummary(token(progressed), {
        ...SYNTHETIC_SUMMARY_INPUT,
        content: {
          ...SYNTHETIC_SUMMARY_INPUT.content,
          subjective: [
            {
              id: "summary-item-invalid",
              text: "근거가 없는 합성 요약",
              evidenceMessageIds: ["message-missing"],
            },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(DatabaseCorruptionError);
    expect((await repository.loadInProgress(progressed.interview.id))?.interview)
      .toEqual(progressed.interview);

    database.close();
  });

  it("aggregate revision이 어긋나면 부분 복원하지 않는다", async () => {
    const repository = createInterviewRepository(database);
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
    const transaction = database.transaction("interviewDrafts", "readwrite");
    transaction.objectStore("interviewDrafts").put({
      ...created.draft,
      revision: 99,
    });
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });

    await expect(
      repository.loadInProgress(created.interview.id),
    ).rejects.toBeInstanceOf(DatabaseCorruptionError);

    database.close();
  });

  it("profile 수정 뒤 과거 완료 snapshot을 바꾸지 않는다", async () => {
    const completedAt = toUtcTimestamp("2026-07-22T01:03:00.000Z");
    const repository = createInterviewRepository(database, {
      now: () => completedAt,
    });
    const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
    const progressed = await repository.saveProgress(
      token(created),
      SYNTHETIC_PROGRESS_INPUT,
    );
    const reviewed = await repository.saveSummary(
      token(progressed),
      SYNTHETIC_SUMMARY_INPUT,
    );

    const completed = await repository.complete(token(reviewed));
    await createProfileRepository(database).saveBundle({
      ...SYNTHETIC_PROFILE_BUNDLE_INPUT,
      profile: {
        ...SYNTHETIC_PROFILE_BUNDLE_INPUT.profile,
        displayName: "이테스트",
        updatedAt: toUtcTimestamp("2026-07-22T01:04:00.000Z"),
      },
    });
    const second = await repository.create({
      ...SYNTHETIC_INTERVIEW_INPUT,
      id: "interview-after-profile-edit",
    });
    const secondProgressInput = {
      ...SYNTHETIC_PROGRESS_INPUT,
      appendedMessages: SYNTHETIC_PROGRESS_INPUT.appendedMessages.map(
        (message) => ({
          ...message,
          id: `${message.id}-after-profile-edit`,
        }),
      ),
    };
    const secondProgress = await repository.saveProgress(
      token(second),
      secondProgressInput,
    );
    const secondReview = await repository.saveSummary(token(secondProgress), {
      ...SYNTHETIC_SUMMARY_INPUT,
      content: {
        ...SYNTHETIC_SUMMARY_INPUT.content,
        subjective: SYNTHETIC_SUMMARY_INPUT.content.subjective.map((item) => ({
          ...item,
          evidenceMessageIds: item.evidenceMessageIds.map(
            (id) => `${id}-after-profile-edit`,
          ),
        })),
      },
    });
    const secondCompleted = await repository.complete(token(secondReview));

    const stored = (await repository.listCompleted()).find(
      ({ id }) => id === completed.interview.id,
    );
    expect(stored?.profileSnapshot?.capturedAt).toBe(completedAt);
    expect(stored?.profileSnapshot?.profile.displayName).toBe("김테스트");
    expect(secondCompleted.interview.profileSnapshot?.profile.displayName).toBe(
      "이테스트",
    );
    expect(stored?.profileSnapshot?.profile.birthDate).toBe("1958-05-20");
    expect(stored?.profileSnapshot?.medicalProfile.conditions).toEqual({
      state: "known",
      values: ["합성 만성질환"],
    });
    expect(stored?.profileSnapshot?.medicalProfile.familyHistory).toEqual({
      state: "unknown",
    });
    expect(stored?.profileSnapshot?.medicalProfile.smoking).toEqual({
      state: "no",
    });
    expect(completed.interview.status).toBe("completed");
    expect(completed.summary?.status).toBe("confirmed");
    expect(completed.draft).toBeUndefined();
    await expect(repository.complete(token(completed))).rejects.toBeInstanceOf(
      ImmutableInterviewError,
    );

    database.close();
  });

  it("V2 완료 기록은 생성 당시 question-set snapshot을 유지한다", async () => {
    const repository = createInterviewRepository(database);
    let id = 0;
    const service = createManualInterviewService({
      repository,
      captureRuntimeGeneration: () => 0,
      randomId: () => `completed-v2-${++id}`,
    });
    let state = await service.loadOrCreate();
    const answers = [
      { text: "합성 두통", selectedOptionIds: [] },
      { text: "", selectedOptionIds: ["today"] },
      { text: "", selectedOptionIds: ["continuous"] },
      { text: "", selectedOptionIds: ["mild"] },
      { text: "합성 추가 내용", selectedOptionIds: [] },
    ];
    for (const answer of answers) {
      state = await service.saveAnswer(state, answer);
    }
    const completed = await service.complete(state);

    expect(completed.interview.schemaVersion).toBe(2);
    if (completed.interview.schemaVersion !== 2) {
      throw new Error("expected-v2-interview");
    }
    expect(completed.interview.questionSetSnapshot).toEqual(
      MANUAL_QUESTION_SET_V2,
    );
    expect(completed.interview.status).toBe("completed");
    expect(completed.draft).toBeUndefined();

    database.close();
  });
});
