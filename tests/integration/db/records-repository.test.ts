import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  InterviewAggregateV1,
  RevisionToken,
} from "@/lib/db/contracts";
import { createConsentRepository } from "@/lib/db/consent-repository";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { ConsentRequiredError } from "@/lib/db/errors";
import { createInterviewRepository } from "@/lib/db/interview-repository";
import { createProfileRepository } from "@/lib/db/profile-repository";
import { createRecordsRepository } from "@/lib/db/records-repository";

import {
  SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
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

async function seedStoredRecords(database: IDBDatabase): Promise<void> {
  await createConsentRepository(database).grant(
    SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
  );
  await createProfileRepository(database).saveBundle(
    SYNTHETIC_PROFILE_BUNDLE_INPUT,
  );

  const interviews = createInterviewRepository(database);
  const created = await interviews.create({
    ...SYNTHETIC_INTERVIEW_INPUT,
    id: "completed-record",
  });
  const progressed = await interviews.saveProgress(token(created), {
    ...SYNTHETIC_PROGRESS_INPUT,
    appendedMessages: [
      structuredClone(SYNTHETIC_PROGRESS_INPUT.appendedMessages[0]),
      {
        ...structuredClone(SYNTHETIC_PROGRESS_INPUT.appendedMessages[1]),
        id: "completed-answer",
        text: "무릎이 불편해요.",
      },
      {
        id: "completed-second-answer",
        sequence: 2,
        role: "user",
        kind: "answer",
        text: "두 번째 답변",
        createdAt: SYNTHETIC_PROGRESS_INPUT.draft.updatedAt,
      },
    ],
  });
  const summarized = await interviews.saveSummary(token(progressed), {
    ...SYNTHETIC_SUMMARY_INPUT,
    content: {
      ...structuredClone(SYNTHETIC_SUMMARY_INPUT.content),
      subjective: [
        {
          id: "completed-summary-item",
          text: "무릎이 불편해요.",
          evidenceMessageIds: ["completed-answer"],
        },
      ],
    },
  });
  await interviews.complete(token(summarized));

  await interviews.create({
    ...SYNTHETIC_INTERVIEW_INPUT,
    id: "draft-record",
  });
}

function withAbortedReadonlyTransactions(
  database: IDBDatabase,
): IDBDatabase {
  return new Proxy(database, {
    get(target, property) {
      if (property === "transaction") {
        return (
          storeNames: string | string[],
          mode?: IDBTransactionMode,
          options?: IDBTransactionOptions,
        ) => {
          const transaction = target.transaction(storeNames, mode, options);
          queueMicrotask(() => transaction.abort());
          return transaction;
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function expectHandledAbort(operation: () => Promise<unknown>) {
  const unhandledRejections: unknown[] = [];
  const captureUnhandled = (reason: unknown) => {
    unhandledRejections.push(reason);
  };
  process.on("unhandledRejection", captureUnhandled);

  try {
    await expect(operation()).rejects.toBeInstanceOf(DOMException);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandledRejections).toEqual([]);
  } finally {
    process.off("unhandledRejection", captureUnhandled);
  }
}

describe("Records repository", () => {
  let database: IDBDatabase;

  beforeEach(async () => {
    database = await openMedicalInterviewDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it("완료 및 진행 중 기록을 나열하고 저장 aggregate를 읽는다", async () => {
    await seedStoredRecords(database);
    const records = createRecordsRepository(database);

    const items = await records.list();
    const aggregate = await records.load("completed-record");

    expect(items.map(({ interview }) => interview.id)).toEqual(
      expect.arrayContaining(["completed-record", "draft-record"]),
    );
    expect(
      items.find(({ interview }) => interview.id === "completed-record"),
    ).toMatchObject({ firstAnswerText: "무릎이 불편해요." });
    expect(aggregate?.messages.map(({ sequence }) => sequence)).toEqual([
      0,
      1,
      2,
    ]);
    expect(aggregate?.summary).toMatchObject({
      status: "confirmed",
      interviewId: "completed-record",
    });
    expect(aggregate).not.toHaveProperty("draft");
  });

  it("동의가 없으면 목록과 상세 읽기를 거부한다", async () => {
    const recordsWithoutConsent = createRecordsRepository(database);

    await expect(recordsWithoutConsent.list()).rejects.toBeInstanceOf(
      ConsentRequiredError,
    );
    await expect(
      recordsWithoutConsent.load("missing-record"),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("동의 후 존재하지 않는 상세 ID는 undefined를 반환한다", async () => {
    await createConsentRepository(database).grant(
      SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
    );
    const records = createRecordsRepository(database);

    await expect(records.load("missing-record")).resolves.toBeUndefined();
  });

  it("database version 1과 기존 8개 store를 유지한다", () => {
    expect(database.version).toBe(1);
    expect([...database.objectStoreNames]).toHaveLength(8);
  });

  it.each([
    ["목록", (records: ReturnType<typeof createRecordsRepository>) => records.list()],
    [
      "상세",
      (records: ReturnType<typeof createRecordsRepository>) =>
        records.load("completed-record"),
    ],
  ])(
    "%s request와 transaction이 함께 abort돼도 rejection을 처리한다",
    async (_, read) => {
      await seedStoredRecords(database);
      const records = createRecordsRepository(
        withAbortedReadonlyTransactions(database),
      );

      await expectHandledAbort(() => read(records));
    },
  );
});
