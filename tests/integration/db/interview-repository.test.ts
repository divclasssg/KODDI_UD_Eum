import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import { createManualInterviewService } from "@/features/interview/manual/manual-interview-service";
import { MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";

import {
  toUtcTimestamp,
  type InterviewAggregateV1,
  type RevisionToken,
} from "@/lib/db/contracts";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
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
  SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
  SYNTHETIC_FINAL_PROGRESS_INPUT,
  SYNTHETIC_INTERVIEW_INPUT,
  SYNTHETIC_INTERVIEW_V2_INPUT,
  SYNTHETIC_PROFILE_BUNDLE_INPUT,
  SYNTHETIC_PROGRESS_INPUT,
  SYNTHETIC_SUMMARY_INPUT,
} from "./fixtures";

function token(aggregate: InterviewAggregateV1): RevisionToken {
  return {
    interviewId: aggregate.interview.id,
    expectedRevision: aggregate.interview.revision,
    runtimeGeneration: 0,
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

    const stored = (await repository.listCompleted()).find(
      ({ id }) => id === completed.interview.id,
    );
    expect(stored?.profileSnapshot?.capturedAt).toBe(completedAt);
    expect(stored?.profileSnapshot?.profile.displayName).toBe("김테스트");
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
