import { describe, expect, it } from "vitest";

import {
  createRecordDetailViewModel,
  createRecordListViewModels,
} from "@/features/records/records-view-model";
import {
  toUtcTimestamp,
  type CompletedProfileSnapshotV1,
  type InterviewAggregateV1,
  type InterviewMessageRecordV1,
  type InterviewRecord,
  type InterviewStatusV1,
  type SummaryRecordV1,
} from "@/lib/db/contracts";
import type { StoredRecordListItem } from "@/lib/db/records-repository";

const NOW = new Date("2026-07-22T15:30:00.000Z");
const TODAY = toUtcTimestamp("2026-07-22T15:20:00.000Z");
const PAST = toUtcTimestamp("2026-07-22T14:50:00.000Z");

const PROFILE_SNAPSHOT: CompletedProfileSnapshotV1 = {
  schemaVersion: 1,
  capturedAt: TODAY,
  profile: {
    schemaVersion: 1,
    displayName: "합성 사용자",
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
};

function interview(
  id: string,
  status: InterviewStatusV1,
  updatedAt = TODAY,
  mode: InterviewRecord["mode"] = "ai",
): InterviewRecord {
  return {
    id,
    schemaVersion: 1,
    revision: 3,
    status,
    mode,
    createdAt: updatedAt,
    updatedAt,
    ...(status === "completed"
      ? {
          completedAt: updatedAt,
          profileSnapshot: structuredClone(PROFILE_SNAPSHOT),
        }
      : {}),
  };
}

function message(
  interviewId: string,
  id: string,
  sequence: number,
  role: InterviewMessageRecordV1["role"],
  kind: InterviewMessageRecordV1["kind"],
  text: string,
): InterviewMessageRecordV1 {
  return {
    interviewId,
    schemaVersion: 1,
    id,
    sequence,
    role,
    kind,
    text,
    createdAt: TODAY,
  };
}

function summary(
  interviewId: string,
  overrides: Partial<SummaryRecordV1> = {},
): SummaryRecordV1 {
  return {
    interviewId,
    schemaVersion: 1,
    revision: 3,
    status: "confirmed",
    source: "ai",
    content: {
      subjective: [
        {
          id: "subjective-1",
          text: "무릎이 어제부터 아파요.",
          evidenceMessageIds: ["answer-1"],
        },
      ],
      objective: [
        {
          id: "objective-1",
          text: "통증 정도는 5예요.",
          evidenceMessageIds: ["answer-2"],
        },
      ],
      verificationNeeded: [
        {
          id: "verification-1",
          text: "정확한 시작 시각은 확인이 필요해요.",
          evidenceMessageIds: ["answer-1"],
        },
      ],
    },
    createdAt: TODAY,
    updatedAt: TODAY,
    confirmedAt: TODAY,
    ...overrides,
  };
}

function validMessages(interviewId: string): InterviewMessageRecordV1[] {
  return [
    message(
      interviewId,
      "question-1",
      0,
      "assistant",
      "question",
      "어디가 불편한가요?",
    ),
    message(
      interviewId,
      "answer-1",
      1,
      "user",
      "answer",
      "무릎이 불편해요.",
    ),
    message(
      interviewId,
      "question-2",
      2,
      "assistant",
      "question",
      "얼마나 불편한가요?",
    ),
    message(interviewId, "answer-2", 3, "user", "answer", "통증 정도는 5예요."),
    message(
      interviewId,
      "completion-1",
      4,
      "system",
      "completion",
      "public-ai-question-generation-complete:v1",
    ),
  ];
}

function completedAggregate(): InterviewAggregateV1 {
  const id = "completed-record";
  return {
    interview: interview(id, "completed"),
    messages: validMessages(id),
    summary: summary(id),
  };
}

describe("createRecordListViewModels", () => {
  it("서울 날짜, 상태 우선순위, 최신 시각으로 기록을 정렬하고 label을 만든다", () => {
    const items: StoredRecordListItem[] = [
      {
        interview: interview(
          "today-review",
          "review",
          toUtcTimestamp("2026-07-22T15:29:00.000Z"),
          "manual",
        ),
        firstAnswerText: "검토 중 답변",
      },
      {
        interview: interview("past-completed", "completed", PAST),
        firstAnswerText: "과거 답변",
      },
      {
        interview: interview(
          "today-safety-stopped",
          "safety-stopped",
          toUtcTimestamp("2026-07-22T15:25:00.000Z"),
        ),
        firstAnswerText: "안전 답변",
      },
      {
        interview: interview(
          "today-draft",
          "draft",
          toUtcTimestamp("2026-07-22T15:29:00.000Z"),
        ),
        firstAnswerText: "작성 중 답변",
      },
      {
        interview: interview("today-completed-newest", "completed"),
        firstAnswerText: "무릎이 불편해요.",
      },
    ];

    const viewModels = createRecordListViewModels(items, NOW);

    expect(viewModels.map(({ id }) => id)).toEqual([
      "today-completed-newest",
      "today-safety-stopped",
      "today-review",
      "today-draft",
      "past-completed",
    ]);
    expect(viewModels[0]).toMatchObject({
      dateLabel: "오늘",
      timeLabel: "00:20",
      statusLabel: "완료",
      modeLabel: "AI 문진",
      chiefComplaint: "무릎이 불편해요.",
    });
    expect(viewModels[2]).toMatchObject({
      statusLabel: "확인 중",
      modeLabel: "수동 문진",
    });
    expect(viewModels[3]?.statusLabel).toBe("작성 중");
    expect(viewModels[1]?.statusLabel).toBe("안전 안내 후 중단");
    expect(viewModels[4]?.dateLabel).toBe("2026년 7월 22일");
  });

  it("날짜, 상태, 시각이 같으면 id 오름차순으로 정렬한다", () => {
    const items: StoredRecordListItem[] = [
      { interview: interview("record-b", "draft") },
      { interview: interview("record-a", "draft") },
    ];

    expect(
      createRecordListViewModels(items, NOW).map(({ id }) => id),
    ).toEqual(["record-a", "record-b"]);
  });

  it("같은 날짜와 status에서는 updatedAt 최신순으로 정렬한다", () => {
    const items: StoredRecordListItem[] = [
      {
        interview: interview(
          "older-review",
          "review",
          toUtcTimestamp("2026-07-22T15:05:00.000Z"),
        ),
      },
      {
        interview: interview(
          "newer-review",
          "review",
          toUtcTimestamp("2026-07-22T15:25:00.000Z"),
        ),
      },
    ];

    expect(
      createRecordListViewModels(items, NOW).map(({ id }) => id),
    ).toEqual(["newer-review", "older-review"]);
  });

  it.each([
    ["누락", undefined],
    ["빈 값", ""],
    ["공백", "   "],
  ])("첫 answer가 %s이면 주요 증상 확인 필요를 표시한다", (_, firstAnswerText) => {
    const item: StoredRecordListItem = {
      interview: interview("missing-answer", "draft"),
      ...(firstAnswerText === undefined ? {} : { firstAnswerText }),
    };

    expect(createRecordListViewModels([item], NOW)[0]?.chiefComplaint).toBe(
      "주요 증상 확인 필요",
    );
  });
});

describe("createRecordDetailViewModel", () => {
  it("완료 aggregate를 summary, 원문 turn, clinician 가능한 상세로 변환한다", () => {
    expect(createRecordDetailViewModel(completedAggregate(), NOW)).toEqual({
      status: "ready",
      record: {
        id: "completed-record",
        dateLabel: "오늘",
        timeLabel: "00:20",
        statusLabel: "완료",
        modeLabel: "AI 문진",
        summarySourceLabel: "AI가 정리한 내용",
        subjective: ["무릎이 어제부터 아파요."],
        objective: ["통증 정도는 5예요."],
        verificationNeeded: ["정확한 시작 시각은 확인이 필요해요."],
        turns: [
          { question: "어디가 불편한가요?", answer: "무릎이 불편해요." },
          { question: "얼마나 불편한가요?", answer: "통증 정도는 5예요." },
        ],
        safetyMessages: [],
        clinicianAvailable: true,
      },
    });
  });

  it("manual summary와 safety message label을 보존한다", () => {
    const aggregate = completedAggregate();
    aggregate.interview.mode = "manual";
    aggregate.messages.splice(
      -1,
      0,
      message(
        aggregate.interview.id,
        "safety-1",
        4,
        "system",
        "safety",
        "안전 안내 문구",
      ),
    );
    aggregate.messages.at(-1)!.sequence = 5;
    aggregate.summary!.source = "manual";

    const result = createRecordDetailViewModel(aggregate, NOW);

    expect(result).toMatchObject({
      status: "ready",
      record: {
        modeLabel: "수동 문진",
        summarySourceLabel: "입력 내용 정리",
        safetyMessages: ["안전 안내 문구"],
      },
    });
  });

  it.each([
    ["confirmed summary 없음", (aggregate: InterviewAggregateV1) => {
      aggregate.summary = undefined;
    }],
    ["confirmed가 아닌 summary", (aggregate: InterviewAggregateV1) => {
      aggregate.summary!.status = "review";
    }],
    ["profile snapshot 없음", (aggregate: InterviewAggregateV1) => {
      aggregate.interview.profileSnapshot = undefined;
    }],
    ["summary interview ID 불일치", (aggregate: InterviewAggregateV1) => {
      aggregate.summary!.interviewId = "other-record";
    }],
    ["summary revision 불일치", (aggregate: InterviewAggregateV1) => {
      aggregate.summary!.revision = aggregate.interview.revision - 1;
    }],
    ["message sequence 불연속", (aggregate: InterviewAggregateV1) => {
      aggregate.messages[1]!.sequence = 2;
    }],
    ["question 없는 answer", (aggregate: InterviewAggregateV1) => {
      aggregate.messages = [
        message(
          aggregate.interview.id,
          "answer-only",
          0,
          "user",
          "answer",
          "대응 질문이 없어요.",
        ),
      ];
      aggregate.summary!.content = {
        subjective: [],
        objective: [],
        verificationNeeded: [],
      };
    }],
    ["assistant question evidence", (aggregate: InterviewAggregateV1) => {
      aggregate.summary!.content.subjective[0]!.evidenceMessageIds = [
        "question-1",
      ];
    }],
    ["존재하지 않는 evidence", (aggregate: InterviewAggregateV1) => {
      aggregate.summary!.content.subjective[0]!.evidenceMessageIds = [
        "missing-answer",
      ];
    }],
    ["비어 있는 evidence", (aggregate: InterviewAggregateV1) => {
      aggregate.summary!.content.subjective[0]!.evidenceMessageIds = [];
    }],
  ])("%s이면 전체 상세를 corrupt로 거절한다", (_, mutate) => {
    const aggregate = completedAggregate();
    mutate(aggregate);

    expect(createRecordDetailViewModel(aggregate, NOW)).toEqual({
      status: "corrupt",
    });
  });

  it.each([
    [
      "review",
      "문진을 완료한 뒤 의료진용 화면을 열 수 있어요.",
    ],
    [
      "draft",
      "문진을 완료한 뒤 의료진용 화면을 열 수 있어요.",
    ],
    [
      "safety-stopped",
      "안전 안내로 중단된 기록은 원문을 확인해 주세요.",
    ],
  ] as const)(
    "%s 기록은 clinician view를 차단한다",
    (status, clinicianBlockedMessage) => {
      const id = `${status}-record`;
      const aggregate: InterviewAggregateV1 = {
        interview: interview(id, status),
        messages:
          status === "safety-stopped"
            ? [
                message(
                  id,
                  "question-1",
                  0,
                  "assistant",
                  "question",
                  "어디가 불편한가요?",
                ),
                message(
                  id,
                  "answer-1",
                  1,
                  "user",
                  "answer",
                  "숨쉬기 힘들어요.",
                ),
                message(
                  id,
                  "safety-1",
                  2,
                  "system",
                  "safety",
                  "즉시 도움을 요청해 주세요.",
                ),
              ]
            : [],
        ...(status === "review"
          ? {
              summary: summary(id, {
                status: "review",
                confirmedAt: undefined,
                content: {
                  subjective: [],
                  objective: [],
                  verificationNeeded: [],
                },
              }),
            }
          : {}),
      };

      expect(createRecordDetailViewModel(aggregate, NOW)).toMatchObject({
        status: "ready",
        record: {
          clinicianAvailable: false,
          clinicianBlockedMessage,
        },
      });
    },
  );
});
