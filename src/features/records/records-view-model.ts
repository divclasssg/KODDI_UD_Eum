import type {
  InterviewAggregateV1,
  InterviewMessageRecordV1,
  InterviewStatusV1,
  UtcTimestamp,
} from "@/lib/db/contracts";
import type { StoredRecordListItem } from "@/lib/db/records-repository";

export type RecordListItemViewModel = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  statusLabel: "완료" | "확인 중" | "작성 중" | "안전 안내 후 중단";
  modeLabel: "AI 문진" | "수동 문진";
  chiefComplaint: string;
};

export type RecordDetailViewModel = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  statusLabel: RecordListItemViewModel["statusLabel"];
  modeLabel: RecordListItemViewModel["modeLabel"];
  summarySourceLabel?: "AI가 정리한 내용" | "입력 내용 정리";
  subjective: string[];
  objective: string[];
  verificationNeeded: string[];
  turns: { question: string; answer: string }[];
  safetyMessages: string[];
  clinicianAvailable: boolean;
  clinicianBlockedMessage?: string;
};

export type RecordDetailResult =
  | { status: "ready"; record: RecordDetailViewModel }
  | { status: "corrupt" };

const SEOUL_TIME_ZONE = "Asia/Seoul";

const STATUS_LABELS = {
  completed: "완료",
  review: "확인 중",
  draft: "작성 중",
  "safety-stopped": "안전 안내 후 중단",
} as const satisfies Record<InterviewStatusV1, RecordListItemViewModel["statusLabel"]>;

const STATUS_RANK = {
  completed: 0,
  "safety-stopped": 1,
  review: 2,
  draft: 3,
} as const satisfies Record<InterviewStatusV1, number>;

const DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: SEOUL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type DateParts = {
  year: string;
  month: string;
  day: string;
};

function dateParts(value: Date): DateParts {
  const parts = DATE_PARTS_FORMATTER.formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = read("year");
  const month = read("month");
  const day = read("day");
  if (!year || !month || !day) throw new RangeError("invalid-date-parts");
  return { year, month, day };
}

function dateKey(value: Date): string {
  const { year, month, day } = dateParts(value);
  return `${year}-${month}-${day}`;
}

function formatTimestamp(
  timestamp: UtcTimestamp,
  now: Date,
): Pick<RecordListItemViewModel, "dateLabel" | "timeLabel"> & {
  dateKey: string;
} {
  const date = new Date(timestamp);
  const parts = dateParts(date);
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    dateKey: key,
    dateLabel:
      key === dateKey(now)
        ? "오늘"
        : `${parts.year}년 ${Number(parts.month)}월 ${Number(parts.day)}일`,
    timeLabel: TIME_FORMATTER.format(date),
  };
}

function modeLabel(
  mode: StoredRecordListItem["interview"]["mode"],
): RecordListItemViewModel["modeLabel"] {
  return mode === "ai" ? "AI 문진" : "수동 문진";
}

export function createRecordListViewModels(
  items: readonly StoredRecordListItem[],
  now: Date,
): RecordListItemViewModel[] {
  return [...items]
    .sort((left, right) => {
      const leftDateKey = formatTimestamp(
        left.interview.updatedAt,
        now,
      ).dateKey;
      const rightDateKey = formatTimestamp(
        right.interview.updatedAt,
        now,
      ).dateKey;
      if (leftDateKey !== rightDateKey) {
        return leftDateKey < rightDateKey ? 1 : -1;
      }
      const statusDifference =
        STATUS_RANK[left.interview.status] -
        STATUS_RANK[right.interview.status];
      if (statusDifference !== 0) return statusDifference;
      if (left.interview.updatedAt !== right.interview.updatedAt) {
        return left.interview.updatedAt < right.interview.updatedAt ? 1 : -1;
      }
      if (left.interview.id === right.interview.id) return 0;
      return left.interview.id < right.interview.id ? -1 : 1;
    })
    .map(({ interview, firstAnswerText }) => {
      const formatted = formatTimestamp(interview.updatedAt, now);
      return {
        id: interview.id,
        dateLabel: formatted.dateLabel,
        timeLabel: formatted.timeLabel,
        statusLabel: STATUS_LABELS[interview.status],
        modeLabel: modeLabel(interview.mode),
        chiefComplaint:
          firstAnswerText?.trim() || "주요 증상 확인 필요",
      };
    });
}

type ValidatedMessages = {
  turns: RecordDetailViewModel["turns"];
  safetyMessages: string[];
  userAnswerIds: Set<string>;
};

function validateMessages(
  messages: readonly InterviewMessageRecordV1[],
  interviewId: string,
): ValidatedMessages | undefined {
  const turns: RecordDetailViewModel["turns"] = [];
  const safetyMessages: string[] = [];
  const userAnswerIds = new Set<string>();
  const messageIds = new Set<string>();

  for (let index = 0; index < messages.length; index += 1) {
    const current = messages[index];
    if (
      !current ||
      current.interviewId !== interviewId ||
      current.sequence !== index ||
      messageIds.has(current.id)
    ) {
      return undefined;
    }
    messageIds.add(current.id);

    if (current.role === "assistant" && current.kind === "question") {
      const answer = messages[index + 1];
      if (
        !answer ||
        answer.interviewId !== interviewId ||
        answer.sequence !== index + 1 ||
        answer.role !== "user" ||
        answer.kind !== "answer" ||
        messageIds.has(answer.id)
      ) {
        return undefined;
      }
      messageIds.add(answer.id);
      userAnswerIds.add(answer.id);
      turns.push({ question: current.text, answer: answer.text });
      index += 1;
      continue;
    }

    if (current.role === "system" && current.kind === "safety") {
      safetyMessages.push(current.text);
      continue;
    }

    if (
      current.role === "system" &&
      current.kind === "completion" &&
      index === messages.length - 1
    ) {
      continue;
    }

    return undefined;
  }

  return { turns, safetyMessages, userAnswerIds };
}

function hasValidEvidence(
  aggregate: InterviewAggregateV1,
  userAnswerIds: ReadonlySet<string>,
): boolean {
  if (!aggregate.summary) return true;
  const items = [
    ...aggregate.summary.content.subjective,
    ...aggregate.summary.content.objective,
    ...aggregate.summary.content.verificationNeeded,
  ];
  return items.every(
    ({ evidenceMessageIds }) =>
      evidenceMessageIds.length > 0 &&
      evidenceMessageIds.every((id) => userAnswerIds.has(id)),
  );
}

export function createRecordDetailViewModel(
  aggregate: InterviewAggregateV1,
  now: Date,
): RecordDetailResult {
  const { interview, summary } = aggregate;
  const validatedMessages = validateMessages(aggregate.messages, interview.id);
  if (
    !validatedMessages ||
    (summary !== undefined &&
      (summary.interviewId !== interview.id ||
        summary.revision !== interview.revision)) ||
    !hasValidEvidence(aggregate, validatedMessages.userAnswerIds) ||
    (interview.status === "completed" &&
      (!interview.profileSnapshot ||
        !summary ||
        summary.status !== "confirmed"))
  ) {
    return { status: "corrupt" };
  }

  const formatted = formatTimestamp(interview.updatedAt, now);
  const clinicianAvailable = interview.status === "completed";
  const clinicianBlockedMessage = clinicianAvailable
    ? undefined
    : interview.status === "safety-stopped"
      ? "안전 안내로 중단된 기록은 원문을 확인해 주세요."
      : "문진을 완료한 뒤 의료진용 화면을 열 수 있어요.";

  return {
    status: "ready",
    record: {
      id: interview.id,
      dateLabel: formatted.dateLabel,
      timeLabel: formatted.timeLabel,
      statusLabel: STATUS_LABELS[interview.status],
      modeLabel: modeLabel(interview.mode),
      ...(summary
        ? {
            summarySourceLabel:
              summary.source === "ai"
                ? "AI가 정리한 내용"
                : "입력 내용 정리",
          }
        : {}),
      subjective: summary?.content.subjective.map(({ text }) => text) ?? [],
      objective: summary?.content.objective.map(({ text }) => text) ?? [],
      verificationNeeded:
        summary?.content.verificationNeeded.map(({ text }) => text) ?? [],
      turns: validatedMessages.turns,
      safetyMessages: validatedMessages.safetyMessages,
      clinicianAvailable,
      ...(clinicianBlockedMessage ? { clinicianBlockedMessage } : {}),
    },
  };
}
