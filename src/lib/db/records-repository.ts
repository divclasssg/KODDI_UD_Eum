import type {
  ConsentRecordV1,
  InterviewAggregateV1,
  InterviewMessageRecordV1,
  InterviewRecord,
  SummaryRecordV1,
} from "./contracts";
import { requestResult, transactionComplete } from "./database";
import { ConsentRequiredError } from "./errors";

export type StoredRecordListItem = {
  interview: InterviewRecord;
  firstAnswerText?: string;
};

export type RecordsRepository = {
  list(): Promise<StoredRecordListItem[]>;
  load(interviewId: string): Promise<InterviewAggregateV1 | undefined>;
};

export function createRecordsRepository(
  database: IDBDatabase,
): RecordsRepository {
  return {
    async list() {
      const transaction = database.transaction(
        ["consents", "interviews", "messages"],
        "readonly",
      );
      const [consent, interviews, messages] = await Promise.all([
        requestResult<ConsentRecordV1 | undefined>(
          transaction.objectStore("consents").get("current"),
        ),
        requestResult<InterviewRecord[]>(
          transaction.objectStore("interviews").getAll(),
        ),
        requestResult<InterviewMessageRecordV1[]>(
          transaction.objectStore("messages").getAll(),
        ),
        transactionComplete(transaction),
      ]);

      if (!consent) throw new ConsentRequiredError();

      const firstAnswers = new Map<string, string>();
      const sortedMessages = structuredClone(messages).sort(
        (left, right) => left.sequence - right.sequence,
      );
      for (const message of sortedMessages) {
        if (
          message.role === "user" &&
          message.kind === "answer" &&
          !firstAnswers.has(message.interviewId)
        ) {
          firstAnswers.set(message.interviewId, message.text);
        }
      }

      return interviews.map((interview) => {
        const firstAnswerText = firstAnswers.get(interview.id);
        return {
          interview: structuredClone(interview),
          ...(firstAnswerText === undefined ? {} : { firstAnswerText }),
        };
      });
    },

    async load(interviewId) {
      const transaction = database.transaction(
        ["consents", "interviews", "messages", "summaries"],
        "readonly",
      );
      const [consent, interview, messages, summary] = await Promise.all([
        requestResult<ConsentRecordV1 | undefined>(
          transaction.objectStore("consents").get("current"),
        ),
        requestResult<InterviewRecord | undefined>(
          transaction.objectStore("interviews").get(interviewId),
        ),
        requestResult<InterviewMessageRecordV1[]>(
          transaction
            .objectStore("messages")
            .index("byInterviewId")
            .getAll(interviewId),
        ),
        requestResult<SummaryRecordV1 | undefined>(
          transaction.objectStore("summaries").get(interviewId),
        ),
        transactionComplete(transaction),
      ]);

      if (!consent) throw new ConsentRequiredError();
      if (!interview) return undefined;

      return {
        interview: structuredClone(interview),
        messages: structuredClone(messages).sort(
          (left, right) => left.sequence - right.sequence,
        ),
        ...(summary === undefined
          ? {}
          : { summary: structuredClone(summary) }),
      };
    },
  };
}
