import { beforeEach, describe, expect, it, vi } from "vitest";

import { toUtcTimestamp } from "@/lib/db/contracts";
import { ConsentRequiredError } from "@/lib/db/errors";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  hasDatabase: vi.fn(),
  list: vi.fn(),
  load: vi.fn(),
  openDatabase: vi.fn(),
}));

vi.mock("@/lib/db/database-presence", () => ({
  hasMedicalInterviewDatabase: mocks.hasDatabase,
}));

vi.mock("@/lib/db/database", () => ({
  openMedicalInterviewDatabase: mocks.openDatabase,
}));

vi.mock("@/lib/db/records-repository", () => ({
  createRecordsRepository: () => ({ list: mocks.list, load: mocks.load }),
}));

import {
  loadRecordDetail,
  loadRecordsList,
} from "@/features/records/load-records";

describe("loadRecordsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabase.mockResolvedValue(true);
    mocks.openDatabase.mockResolvedValue({ close: mocks.close });
  });

  it("저장 목록을 공개 view model로 변환하고 database를 닫는다", async () => {
    mocks.list.mockResolvedValue([
      {
        interview: {
          id: "stored-record",
          schemaVersion: 1,
          revision: 1,
          status: "draft",
          mode: "manual",
          createdAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
          updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
        },
        firstAnswerText: "무릎이 불편해요.",
      },
    ]);

    await expect(
      loadRecordsList(new Date("2026-07-22T02:00:00.000Z")),
    ).resolves.toEqual({
      status: "ready",
      records: [
        {
          id: "stored-record",
          dateLabel: "오늘",
          timeLabel: "10:00",
          statusLabel: "작성 중",
          modeLabel: "수동 문진",
          chiefComplaint: "무릎이 불편해요.",
        },
      ],
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("database가 없으면 열지 않고 missing을 반환한다", async () => {
    mocks.hasDatabase.mockResolvedValue(false);

    await expect(loadRecordsList()).resolves.toEqual({ status: "missing" });
    expect(mocks.openDatabase).not.toHaveBeenCalled();
  });

  it("동의가 없으면 missing으로 일반화하고 database를 닫는다", async () => {
    mocks.list.mockRejectedValue(new ConsentRequiredError());

    await expect(loadRecordsList()).resolves.toEqual({ status: "missing" });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("그 밖의 읽기 실패는 원문 없이 error로 일반화한다", async () => {
    mocks.list.mockRejectedValue(
      new Error("Persona fixture 무릎 의료정보 raw database error"),
    );

    await expect(loadRecordsList()).resolves.toEqual({ status: "error" });
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});

describe("loadRecordDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabase.mockResolvedValue(true);
    mocks.openDatabase.mockResolvedValue({ close: mocks.close });
  });

  it("database가 없으면 열지 않고 missing-database를 반환한다", async () => {
    mocks.hasDatabase.mockResolvedValue(false);

    await expect(loadRecordDetail("missing-database")).resolves.toEqual({
      status: "missing-database",
    });
    expect(mocks.openDatabase).not.toHaveBeenCalled();
  });

  it("존재하지 않는 ID는 not-found로 일반화하고 database를 닫는다", async () => {
    mocks.load.mockResolvedValue(undefined);

    await expect(loadRecordDetail("unknown-record")).resolves.toEqual({
      status: "not-found",
    });
    expect(mocks.load).toHaveBeenCalledWith("unknown-record");
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("손상 aggregate는 의료 내용을 반환하지 않고 database를 닫는다", async () => {
    mocks.load.mockResolvedValue({
      interview: {
        id: "corrupt-record",
        schemaVersion: 1,
        revision: 1,
        status: "completed",
        mode: "manual",
        createdAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
        updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
      },
      messages: [],
    });

    await expect(loadRecordDetail("corrupt-record")).resolves.toEqual({
      status: "corrupt",
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("완료 aggregate를 상세 view model로 변환하고 database를 닫는다", async () => {
    const timestamp = toUtcTimestamp("2026-07-22T01:00:00.000Z");
    mocks.load.mockResolvedValue({
      interview: {
        id: "completed-record",
        schemaVersion: 1,
        revision: 2,
        status: "completed",
        mode: "ai",
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: timestamp,
        profileSnapshot: {
          schemaVersion: 1,
          capturedAt: timestamp,
          profile: {
            schemaVersion: 1,
            displayName: "표시하지 않을 이름",
            birthDate: "1960-05-20",
            sex: "unknown",
          },
          medicalProfile: {
            schemaVersion: 1,
            conditions: { state: "unknown" },
            medications: { state: "unknown" },
            allergies: { state: "unknown" },
            familyHistory: { state: "unknown" },
            medicalHistory: { state: "unknown" },
            surgicalHistory: { state: "unknown" },
            smoking: { state: "unknown" },
            alcohol: { state: "unknown" },
          },
        },
      },
      messages: [
        {
          interviewId: "completed-record",
          schemaVersion: 1,
          id: "question-1",
          sequence: 0,
          role: "assistant",
          kind: "question",
          text: "어디가 불편한가요?",
          createdAt: timestamp,
        },
        {
          interviewId: "completed-record",
          schemaVersion: 1,
          id: "answer-1",
          sequence: 1,
          role: "user",
          kind: "answer",
          text: "무릎이 불편해요.",
          createdAt: timestamp,
        },
      ],
      summary: {
        interviewId: "completed-record",
        schemaVersion: 1,
        revision: 2,
        status: "confirmed",
        source: "ai",
        content: {
          subjective: [
            {
              id: "subjective-1",
              text: "무릎이 불편해요.",
              evidenceMessageIds: ["answer-1"],
            },
          ],
          objective: [],
          verificationNeeded: [],
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        confirmedAt: timestamp,
      },
    });

    await expect(
      loadRecordDetail(
        "completed-record",
        new Date("2026-07-22T02:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      status: "ready",
      record: {
        id: "completed-record",
        statusLabel: "완료",
        summarySourceLabel: "AI가 정리한 내용",
        subjective: ["무릎이 불편해요."],
        clinicianAvailable: true,
      },
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("동의 없음은 missing-database로 일반화하고 database를 닫는다", async () => {
    mocks.load.mockRejectedValue(new ConsentRequiredError());

    await expect(loadRecordDetail("stored-record")).resolves.toEqual({
      status: "missing-database",
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("repository 오류는 원문 없이 error로 일반화하고 database를 닫는다", async () => {
    mocks.load.mockRejectedValue(
      new Error("raw profile snapshot and medical answer"),
    );

    await expect(loadRecordDetail("stored-record")).resolves.toEqual({
      status: "error",
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
