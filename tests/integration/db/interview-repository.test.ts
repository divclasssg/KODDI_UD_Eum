import { beforeEach, describe, expect, it } from "vitest";

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
});
