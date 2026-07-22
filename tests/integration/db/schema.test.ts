import { describe, expect, it } from "vitest";

import {
  openDatabaseWithMigrations,
  openMedicalInterviewDatabase,
  requestResult,
  transactionComplete,
} from "@/lib/db/database";
import {
  DatabaseMigrationError,
  DatabaseUpgradeBlockedError,
  DatabaseVersionTooNewError,
} from "@/lib/db/errors";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  STORE_NAMES,
  migrateToV1,
} from "@/lib/db/schema";

describe("IndexedDB v1 schema", () => {
  it("database 이름과 version을 고정한다", async () => {
    const database = await openMedicalInterviewDatabase();

    expect(database.name).toBe(DATABASE_NAME);
    expect(database.version).toBe(DATABASE_VERSION);

    database.close();
  });

  it("v1 object store와 index를 정확히 만든다", async () => {
    const database = await openMedicalInterviewDatabase();

    expect([...database.objectStoreNames]).toEqual([...STORE_NAMES].sort());

    const transaction = database.transaction(STORE_NAMES, "readonly");
    const interviews = transaction.objectStore("interviews");
    const drafts = transaction.objectStore("interviewDrafts");
    const messages = transaction.objectStore("messages");
    const summaries = transaction.objectStore("summaries");
    const attachments = transaction.objectStore("attachments");

    expect(interviews.keyPath).toBe("id");
    expect([...interviews.indexNames]).toEqual([
      "byStatus",
      "byStatusUpdatedAt",
      "byUpdatedAt",
    ]);
    expect(interviews.index("byStatusUpdatedAt").keyPath).toEqual([
      "status",
      "updatedAt",
    ]);
    expect(drafts.keyPath).toBe("interviewId");
    expect([...drafts.indexNames]).toEqual(["byUpdatedAt"]);
    expect(messages.keyPath).toBe("id");
    expect([...messages.indexNames]).toEqual([
      "byInterviewId",
      "byInterviewSequence",
    ]);
    expect(messages.index("byInterviewSequence").keyPath).toEqual([
      "interviewId",
      "sequence",
    ]);
    expect(messages.index("byInterviewSequence").unique).toBe(true);
    expect(summaries.keyPath).toBe("interviewId");
    expect([...summaries.indexNames]).toEqual(["byStatus", "byUpdatedAt"]);
    expect(attachments.keyPath).toBe("id");
    expect([...attachments.indexNames]).toEqual([
      "byInterviewCreatedAt",
      "byInterviewId",
      "byKind",
    ]);
    expect(attachments.index("byInterviewCreatedAt").keyPath).toEqual([
      "interviewId",
      "createdAt",
    ]);

    database.close();
  });

  it("migration 실패 시 기존 data와 version을 보존한다", async () => {
    const v1 = await openMedicalInterviewDatabase();
    const transaction = v1.transaction("profiles", "readwrite");
    transaction.objectStore("profiles").put({
      id: "default",
      schemaVersion: 1,
      displayName: "합성 보존 확인",
      birthDate: "1956-05-20",
      sex: "unknown",
      updatedAt: "2026-07-22T01:00:00.000Z",
    });
    await transactionComplete(transaction);
    v1.close();

    await expect(
      openDatabaseWithMigrations({
        targetVersion: 2,
        migrations: {
          2() {
            throw new Error("합성 migration 실패");
          },
        },
      }),
    ).rejects.toBeInstanceOf(DatabaseMigrationError);

    const reopened = await openMedicalInterviewDatabase();
    const readTransaction = reopened.transaction("profiles", "readonly");
    const profile = await requestResult(
      readTransaction.objectStore("profiles").get("default"),
    );
    expect(reopened.version).toBe(1);
    expect(profile).toEqual(
      expect.objectContaining({ displayName: "합성 보존 확인" }),
    );
    reopened.close();
  });

  it("현재 앱보다 높은 database version을 typed error로 거절한다", async () => {
    const higherVersion = await openDatabaseWithMigrations({
      targetVersion: 2,
      migrations: {
        1: (database) => migrateToV1(database),
        2: () => undefined,
      },
    });
    higherVersion.close();

    await expect(openMedicalInterviewDatabase()).rejects.toBeInstanceOf(
      DatabaseVersionTooNewError,
    );
  });

  it("열린 connection이 upgrade를 막으면 typed error를 반환한다", async () => {
    const blockingFactory = new IDBFactory();
    const blocker = await openDatabaseWithMigrations({
      factory: blockingFactory,
      targetVersion: 1,
      closeOnVersionChange: false,
      migrations: { 1: (database) => migrateToV1(database) },
    });

    const upgrade = openDatabaseWithMigrations({
      factory: blockingFactory,
      targetVersion: 2,
      closeOnVersionChange: false,
      migrations: { 2: () => undefined },
    });

    await expect(upgrade).rejects.toBeInstanceOf(DatabaseUpgradeBlockedError);
    blocker.close();
    await new Promise<void>((resolve, reject) => {
      const request = blockingFactory.deleteDatabase(DATABASE_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  });

  it("versionchange를 받으면 기존 connection을 닫아 upgrade를 허용한다", async () => {
    const database = await openMedicalInterviewDatabase();
    const upgraded = await openDatabaseWithMigrations({
      targetVersion: 2,
      migrations: { 2: () => undefined },
    });

    expect(upgraded.version).toBe(2);
    upgraded.close();
    database.close();
  });
});
