import { describe, expect, it } from "vitest";

import type { InterviewAggregateV1, RevisionToken } from "@/lib/db/contracts";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import {
  ConsentRequiredError,
  RevisionConflictError,
} from "@/lib/db/errors";
import { createConsentRepository } from "@/lib/db/consent-repository";
import { createInterviewRepository } from "@/lib/db/interview-repository";
import { createLocalDataRepository } from "@/lib/db/local-data-repository";
import { createProfileRepository } from "@/lib/db/profile-repository";
import { createRuntimeRevisionGuard } from "@/lib/db/revision-guard";

import {
  SYNTHETIC_DECIDED_AT,
  SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
  SYNTHETIC_INTERVIEW_INPUT,
  SYNTHETIC_PROFILE_BUNDLE_INPUT,
  SYNTHETIC_PROGRESS_INPUT,
  SYNTHETIC_SUMMARY_INPUT,
} from "./fixtures";

const SEEDED_COUNTS = {
  attachments: 1,
  consents: 1,
  interviewDrafts: 1,
  interviews: 1,
  medicalProfiles: 1,
  messages: 2,
  profiles: 1,
  summaries: 1,
};

const EMPTY_COUNTS = {
  attachments: 0,
  consents: 0,
  interviewDrafts: 0,
  interviews: 0,
  medicalProfiles: 0,
  messages: 0,
  profiles: 0,
  summaries: 0,
};

function token(aggregate: InterviewAggregateV1): RevisionToken {
  return {
    interviewId: aggregate.interview.id,
    expectedRevision: aggregate.interview.revision,
    runtimeGeneration: 0,
  };
}

async function seedEveryStore(database: IDBDatabase) {
  await createConsentRepository(database).grant(
    SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
  );
  await createProfileRepository(database).saveBundle(
    SYNTHETIC_PROFILE_BUNDLE_INPUT,
  );
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
  const transaction = database.transaction("attachments", "readwrite");
  transaction.objectStore("attachments").add({
    id: "attachment-synthetic-001",
    schemaVersion: 1,
    interviewId: reviewed.interview.id,
    kind: "photo",
    createdAt: SYNTHETIC_DECIDED_AT,
    blob: new Blob(["synthetic attachment"], { type: "text/plain" }),
  });
  await new Promise<void>((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
  return reviewed;
}

describe("local data reset", () => {
  it("모든 store를 한 transaction으로 비운다", async () => {
    const database = await openMedicalInterviewDatabase();
    await seedEveryStore(database);
    const repository = createLocalDataRepository(database);

    expect(await repository.countAll()).toEqual(SEEDED_COUNTS);
    await repository.resetAll();
    expect(await repository.countAll()).toEqual(EMPTY_COUNTS);

    database.close();
  });

  it("reset transaction이 abort되면 어떤 store도 부분 삭제하지 않는다", async () => {
    const database = await openMedicalInterviewDatabase();
    await seedEveryStore(database);
    const repository = createLocalDataRepository(database, {
      beforeClearStore(storeName) {
        if (storeName === "interviews") {
          throw new Error("합성 reset 실패");
        }
      },
    });

    await expect(repository.resetAll()).rejects.toThrow("합성 reset 실패");
    expect(await repository.countAll()).toEqual(SEEDED_COUNTS);

    database.close();
  });

  it("reset 뒤 이전 generation과 누락 consent가 늦은 쓰기를 막는다", async () => {
    const database = await openMedicalInterviewDatabase();
    const reviewed = await seedEveryStore(database);
    const guard = createRuntimeRevisionGuard();
    const guardedRepository = createInterviewRepository(database, {
      assertRuntimeGeneration: guard.assertCurrent,
    });
    const unguardedRepository = createInterviewRepository(database);
    const localDataRepository = createLocalDataRepository(database);
    const capturedGeneration = guard.capture();
    const lateToken = {
      ...token(reviewed),
      runtimeGeneration: capturedGeneration,
    };

    guard.invalidate();
    await localDataRepository.resetAll();

    await expect(
      guardedRepository.saveProgress(lateToken, SYNTHETIC_PROGRESS_INPUT),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    await expect(
      unguardedRepository.saveProgress(lateToken, SYNTHETIC_PROGRESS_INPUT),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(await localDataRepository.countAll()).toEqual(EMPTY_COUNTS);

    database.close();
  });
});
