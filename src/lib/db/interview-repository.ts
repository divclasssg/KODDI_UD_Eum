import type {
  ConsentRecordV1,
  CreateInterviewInput,
  InterviewAggregateV1,
  InterviewDraftRecord,
  InterviewDraftInputV1,
  InterviewDraftInputV2,
  InterviewDraftRecordV2,
  InterviewMessageRecordV1,
  InterviewRecord,
  InterviewRecordV1,
  InterviewRecordV2,
  MedicalProfileRecordV1,
  PersistDraftInputV2,
  ProfileRecordV1,
  RevisionToken,
  SaveFinalProgressInput,
  SaveProgressInput,
  SaveSummaryInputV1,
  SummaryRecordV1,
  UpgradeLegacyDraftInputV2,
  UtcTimestamp,
} from "./contracts";
import { requestResult, transactionComplete } from "./database";
import {
  ConsentRequiredError,
  DatabaseCorruptionError,
  ImmutableInterviewError,
  InterviewNotFoundError,
  RevisionConflictError,
} from "./errors";

export type InterviewRepository = {
  create(input: CreateInterviewInput): Promise<InterviewAggregateV1>;
  findLatestInProgress(
    mode: "ai" | "manual",
  ): Promise<InterviewAggregateV1 | undefined>;
  loadInProgress(id: string): Promise<InterviewAggregateV1 | undefined>;
  upgradeLegacyDraft(
    token: RevisionToken,
    input: UpgradeLegacyDraftInputV2,
  ): Promise<InterviewAggregateV1>;
  persistDraft(
    token: RevisionToken,
    input: PersistDraftInputV2,
  ): Promise<InterviewAggregateV1>;
  saveProgress(
    token: RevisionToken,
    input: SaveProgressInput,
  ): Promise<InterviewAggregateV1>;
  saveSummary(
    token: RevisionToken,
    input: SaveSummaryInputV1,
  ): Promise<InterviewAggregateV1>;
  saveFinalProgress(
    token: RevisionToken,
    input: SaveFinalProgressInput,
  ): Promise<InterviewAggregateV1>;
  complete(token: RevisionToken): Promise<InterviewAggregateV1>;
  listCompleted(): Promise<InterviewRecord[]>;
};

type InterviewRepositoryOptions = {
  now?: () => UtcTimestamp;
  assertRuntimeGeneration?: (generation: number) => void;
  beforeFinalPut?: (
    storeName: "interviews" | "interviewDrafts" | "messages" | "summaries",
  ) => void;
};

async function requireConsent(transaction: IDBTransaction): Promise<void> {
  const consent = await requestResult<ConsentRecordV1 | undefined>(
    transaction.objectStore("consents").get("current"),
  );
  if (!consent) {
    transaction.abort();
    throw new ConsentRequiredError();
  }
}

function assertMutableInterview(
  interview: InterviewRecord | undefined,
  token: RevisionToken,
): asserts interview is InterviewRecord {
  if (!interview || interview.id !== token.interviewId) {
    throw new InterviewNotFoundError();
  }
  if (interview.revision !== token.expectedRevision) {
    throw new RevisionConflictError();
  }
  if (
    interview.status === "completed" ||
    interview.status === "safety-stopped"
  ) {
    throw new ImmutableInterviewError();
  }
}

function validateAggregate(aggregate: InterviewAggregateV1): void {
  if (
    aggregate.draft &&
    aggregate.draft.revision !== aggregate.interview.revision
  ) {
    throw new DatabaseCorruptionError();
  }
  if (
    aggregate.summary &&
    aggregate.summary.revision !== aggregate.interview.revision
  ) {
    throw new DatabaseCorruptionError();
  }
  if (
    aggregate.messages.some(
      (message, index) => message.sequence !== index,
    )
  ) {
    throw new DatabaseCorruptionError();
  }
}

async function readAggregate(
  transaction: IDBTransaction,
  interviewId: string,
): Promise<InterviewAggregateV1 | undefined> {
  const interview = await requestResult<InterviewRecord | undefined>(
    transaction.objectStore("interviews").get(interviewId),
  );
  if (!interview) return undefined;
  const draft = await requestResult<InterviewDraftRecord | undefined>(
    transaction.objectStore("interviewDrafts").get(interviewId),
  );
  const messages = await requestResult<InterviewMessageRecordV1[]>(
    transaction
      .objectStore("messages")
      .index("byInterviewId")
      .getAll(interviewId),
  );
  const summary = await requestResult<SummaryRecordV1 | undefined>(
    transaction.objectStore("summaries").get(interviewId),
  );
  const aggregate = {
    interview,
    draft,
    messages: messages.sort((left, right) => left.sequence - right.sequence),
    summary,
  };
  validateAggregate(aggregate);
  return aggregate;
}

export function createInterviewRepository(
  database: IDBDatabase,
  options: InterviewRepositoryOptions = {},
): InterviewRepository {
  const now = options.now ?? (() => new Date().toISOString() as UtcTimestamp);
  const assertRuntimeGeneration = options.assertRuntimeGeneration ?? (() => {});
  const loadInProgress = async (id: string) => {
    const transaction = database.transaction(
      ["consents", "interviews", "interviewDrafts", "messages", "summaries"],
      "readonly",
    );
    await requireConsent(transaction);
    const aggregate = await readAggregate(transaction, id);
    if (
      aggregate?.interview.status === "completed" ||
      aggregate?.interview.status === "safety-stopped"
    ) {
      return undefined;
    }
    return aggregate;
  };

  return {
    async create(input) {
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts"],
        "readwrite",
      );
      await requireConsent(transaction);
      let interview: InterviewRecord;
      let draft: InterviewDraftRecord;
      if ("questionSetSnapshot" in input) {
        interview = {
          id: input.id,
          schemaVersion: 2,
          revision: 1,
          status: "draft",
          mode: input.mode,
          createdAt: input.createdAt,
          updatedAt: input.draft.updatedAt,
          questionSetSnapshot: structuredClone(input.questionSetSnapshot),
        };
        draft = {
          interviewId: input.id,
          schemaVersion: 2,
          revision: 1,
          ...input.draft,
        };
      } else {
        interview = {
          id: input.id,
          schemaVersion: 1,
          revision: 1,
          status: "draft",
          mode: input.mode,
          createdAt: input.createdAt,
          updatedAt: input.draft.updatedAt,
        };
        draft = {
          interviewId: input.id,
          schemaVersion: 1,
          revision: 1,
          ...input.draft,
        };
      }
      transaction.objectStore("interviews").add(interview);
      transaction.objectStore("interviewDrafts").add(draft);
      await transactionComplete(transaction);
      return { interview, draft, messages: [] };
    },
    async findLatestInProgress(mode) {
      const transaction = database.transaction(
        ["consents", "interviews"],
        "readonly",
      );
      const completion = transactionComplete(transaction);
      await requireConsent(transaction);
      const index = transaction.objectStore("interviews").index("byStatusUpdatedAt");
      const [drafts, reviews] = await Promise.all([
        requestResult<InterviewRecordV1[]>(
          index.getAll(IDBKeyRange.bound(["draft", ""], ["draft", "\uffff"])),
        ),
        requestResult<InterviewRecordV1[]>(
          index.getAll(IDBKeyRange.bound(["review", ""], ["review", "\uffff"])),
        ),
      ]);
      await completion;
      const latest = [...drafts, ...reviews]
        .filter((interview) => interview.mode === mode)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
      return latest ? loadInProgress(latest.id) : undefined;
    },
    loadInProgress,
    async upgradeLegacyDraft(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts"],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const draft = await requestResult<InterviewDraftRecord | undefined>(
        transaction.objectStore("interviewDrafts").get(token.interviewId),
      );
      if (
        interview.schemaVersion !== 1 ||
        draft?.schemaVersion !== 1 ||
        draft.revision !== interview.revision ||
        input.commonDraft.questionId !== draft.currentQuestion.id ||
        !input.questionSetSnapshot.questions.some(
          ({ id }) => id === input.commonDraft.questionId,
        )
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const nextRevision = interview.revision + 1;
      const nextInterview: InterviewRecordV2 = {
        ...interview,
        schemaVersion: 2,
        revision: nextRevision,
        updatedAt: input.updatedAt,
        questionSetSnapshot: structuredClone(input.questionSetSnapshot),
      };
      const commonDraft = structuredClone(input.commonDraft);
      const selectedOptionIds =
        commonDraft.activeMode === "chip"
          ? commonDraft.values.chip.selectedOptionIds
          : commonDraft.values.choice.selectedOptionIds;
      const nextDraft: InterviewDraftRecordV2 = {
        ...draft,
        schemaVersion: 2,
        revision: nextRevision,
        updatedAt: input.updatedAt,
        input: {
          mode:
            commonDraft.activeMode === "chip"
              ? "choice"
              : commonDraft.activeMode,
          text: commonDraft.values.text.value,
          selectedOptionIds: [...selectedOptionIds],
          commonDraft,
        },
      };
      transaction.objectStore("interviews").put(nextInterview);
      transaction.objectStore("interviewDrafts").put(nextDraft);
      await transactionComplete(transaction);
      const aggregate = await loadInProgress(interview.id);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async persistDraft(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts"],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const draft = await requestResult<InterviewDraftRecord | undefined>(
        transaction.objectStore("interviewDrafts").get(token.interviewId),
      );
      if (
        interview.schemaVersion !== 2 ||
        draft?.schemaVersion !== 2 ||
        draft.revision !== interview.revision ||
        input.commonDraft.questionId !== draft.currentQuestion.id ||
        !interview.questionSetSnapshot.questions.some(
          ({ id }) => id === input.commonDraft.questionId,
        )
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const nextRevision = interview.revision + 1;
      const nextInterview: InterviewRecordV2 = {
        ...interview,
        revision: nextRevision,
        updatedAt: input.updatedAt,
      };
      const commonDraft = structuredClone(input.commonDraft);
      const selectedOptionIds =
        commonDraft.activeMode === "chip"
          ? commonDraft.values.chip.selectedOptionIds
          : commonDraft.values.choice.selectedOptionIds;
      const nextDraft: InterviewDraftRecordV2 = {
        ...draft,
        revision: nextRevision,
        updatedAt: input.updatedAt,
        input: {
          mode:
            commonDraft.activeMode === "chip"
              ? "choice"
              : commonDraft.activeMode,
          text: commonDraft.values.text.value,
          selectedOptionIds: [...selectedOptionIds],
          ...(commonDraft.values.measurement.state === "known"
            ? {
                measurement: {
                  value: Number(commonDraft.values.measurement.rawValue),
                  unit: commonDraft.values.measurement.unitId,
                },
              }
            : {}),
          commonDraft,
        },
      };
      transaction.objectStore("interviews").put(nextInterview);
      transaction.objectStore("interviewDrafts").put(nextDraft);
      await transactionComplete(transaction);
      const aggregate = await loadInProgress(interview.id);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async saveProgress(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const existingMessages = await requestResult<InterviewMessageRecordV1[]>(
        transaction
          .objectStore("messages")
          .index("byInterviewId")
          .getAll(token.interviewId),
      );
      if (
        input.appendedMessages.some(
          (message, index) =>
            message.sequence !== existingMessages.length + index,
        )
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const nextRevision = interview.revision + 1;
      const nextInterview: InterviewRecord = {
        ...interview,
        revision: nextRevision,
        status: "draft",
        updatedAt: input.draft.updatedAt,
      };
      let nextDraft: InterviewDraftRecord;
      if (interview.schemaVersion === 2) {
        if (!("commonDraft" in input.draft.input)) {
          transaction.abort();
          throw new DatabaseCorruptionError();
        }
        const draftInput = input.draft as InterviewDraftInputV2;
        nextDraft = {
          interviewId: interview.id,
          schemaVersion: 2,
          revision: nextRevision,
          ...draftInput,
        };
      } else {
        if ("commonDraft" in input.draft.input) {
          transaction.abort();
          throw new DatabaseCorruptionError();
        }
        const draftInput = input.draft as InterviewDraftInputV1;
        nextDraft = {
          interviewId: interview.id,
          schemaVersion: 1,
          revision: nextRevision,
          ...draftInput,
        };
      }
      transaction.objectStore("interviews").put(nextInterview);
      transaction.objectStore("interviewDrafts").put(nextDraft);
      transaction.objectStore("summaries").delete(interview.id);
      for (const message of input.appendedMessages) {
        const record: InterviewMessageRecordV1 = {
          interviewId: interview.id,
          schemaVersion: 1,
          ...message,
        };
        transaction.objectStore("messages").add(record);
      }
      await transactionComplete(transaction);
      const aggregate = await loadInProgress(interview.id);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async saveSummary(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const draft = await requestResult<InterviewDraftRecord | undefined>(
        transaction.objectStore("interviewDrafts").get(interview.id),
      );
      if (!draft || draft.revision !== interview.revision) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const messages = await requestResult<InterviewMessageRecordV1[]>(
        transaction
          .objectStore("messages")
          .index("byInterviewId")
          .getAll(interview.id),
      );
      const messageIds = new Set(messages.map(({ id }) => id));
      const summaryItems = [
        ...input.content.subjective,
        ...input.content.objective,
        ...input.content.verificationNeeded,
      ];
      if (
        summaryItems.some(({ evidenceMessageIds }) =>
          evidenceMessageIds.some((id) => !messageIds.has(id)),
        )
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const nextRevision = interview.revision + 1;
      const nextInterview: InterviewRecord = {
        ...interview,
        revision: nextRevision,
        status: "review",
        updatedAt: input.updatedAt,
      };
      const nextDraft = { ...draft, revision: nextRevision };
      const summary: SummaryRecordV1 = {
        interviewId: interview.id,
        schemaVersion: 1,
        revision: nextRevision,
        status: "review",
        ...input,
      };
      transaction.objectStore("interviews").put(nextInterview);
      transaction.objectStore("interviewDrafts").put(nextDraft);
      transaction.objectStore("summaries").put(summary);
      await transactionComplete(transaction);
      const aggregate = await loadInProgress(interview.id);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async saveFinalProgress(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      try {
        await requireConsent(transaction);
        const interview = await requestResult<InterviewRecord | undefined>(
          transaction.objectStore("interviews").get(token.interviewId),
        );
        assertMutableInterview(interview, token);
        const existingMessages = await requestResult<InterviewMessageRecordV1[]>(
          transaction
            .objectStore("messages")
            .index("byInterviewId")
            .getAll(interview.id),
        );
        if (
          input.appendedMessages.some(
            (message, index) =>
              message.sequence !== existingMessages.length + index,
          )
        ) {
          throw new DatabaseCorruptionError();
        }
        const evidenceIds = new Set([
          ...existingMessages.map(({ id }) => id),
          ...input.appendedMessages.map(({ id }) => id),
        ]);
        const summaryItems = [
          ...input.summary.content.subjective,
          ...input.summary.content.objective,
          ...input.summary.content.verificationNeeded,
        ];
        if (
          summaryItems.some(({ evidenceMessageIds }) =>
            evidenceMessageIds.some((id) => !evidenceIds.has(id)),
          )
        ) {
          throw new DatabaseCorruptionError();
        }
        const nextRevision = interview.revision + 1;
        const nextInterview: InterviewRecord = {
          ...interview,
          revision: nextRevision,
          status: "review",
          updatedAt: input.summary.updatedAt,
        };
        let nextDraft: InterviewDraftRecord;
        if (interview.schemaVersion === 2) {
          if (!("commonDraft" in input.draft.input)) {
            throw new DatabaseCorruptionError();
          }
          const draftInput = input.draft as InterviewDraftInputV2;
          nextDraft = {
            interviewId: interview.id,
            schemaVersion: 2,
            revision: nextRevision,
            ...draftInput,
          };
        } else {
          if ("commonDraft" in input.draft.input) {
            throw new DatabaseCorruptionError();
          }
          const draftInput = input.draft as InterviewDraftInputV1;
          nextDraft = {
            interviewId: interview.id,
            schemaVersion: 1,
            revision: nextRevision,
            ...draftInput,
          };
        }
        const summary: SummaryRecordV1 = {
          interviewId: interview.id,
          schemaVersion: 1,
          revision: nextRevision,
          status: "review",
          ...input.summary,
        };
        options.beforeFinalPut?.("interviews");
        transaction.objectStore("interviews").put(nextInterview);
        options.beforeFinalPut?.("interviewDrafts");
        transaction.objectStore("interviewDrafts").put(nextDraft);
        for (const message of input.appendedMessages) {
          options.beforeFinalPut?.("messages");
          const record: InterviewMessageRecordV1 = {
            interviewId: interview.id,
            schemaVersion: 1,
            ...message,
          };
          transaction.objectStore("messages").add(record);
        }
        options.beforeFinalPut?.("summaries");
        transaction.objectStore("summaries").put(summary);
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          await completion.catch(() => undefined);
          throw error;
        }
        await completion.catch(() => undefined);
        throw error;
      }
      await completion;
      const aggregate = await loadInProgress(token.interviewId);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async complete(token) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "profiles",
          "medicalProfiles",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const profile = await requestResult<ProfileRecordV1 | undefined>(
        transaction.objectStore("profiles").get("default"),
      );
      const medicalProfile = await requestResult<
        MedicalProfileRecordV1 | undefined
      >(transaction.objectStore("medicalProfiles").get("default"));
      const draft = await requestResult<InterviewDraftRecord | undefined>(
        transaction.objectStore("interviewDrafts").get(interview.id),
      );
      const summary = await requestResult<SummaryRecordV1 | undefined>(
        transaction.objectStore("summaries").get(interview.id),
      );
      if (
        interview.status !== "review" ||
        !profile ||
        !medicalProfile ||
        !draft ||
        draft.revision !== interview.revision ||
        !summary ||
        summary.revision !== interview.revision
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const completedAt = now();
      const nextRevision = interview.revision + 1;
      const completedInterview: InterviewRecord = {
        ...interview,
        revision: nextRevision,
        status: "completed",
        updatedAt: completedAt,
        completedAt,
        profileSnapshot: {
          schemaVersion: 1,
          capturedAt: completedAt,
          profile: {
            schemaVersion: profile.schemaVersion,
            displayName: profile.displayName,
            birthDate: profile.birthDate,
            sex: profile.sex,
          },
          medicalProfile: {
            schemaVersion: medicalProfile.schemaVersion,
            conditions: structuredClone(medicalProfile.conditions),
            medications: structuredClone(medicalProfile.medications),
            allergies: structuredClone(medicalProfile.allergies),
            familyHistory: structuredClone(medicalProfile.familyHistory),
            medicalHistory: structuredClone(medicalProfile.medicalHistory),
            surgicalHistory: structuredClone(medicalProfile.surgicalHistory),
            smoking: structuredClone(medicalProfile.smoking),
            alcohol: structuredClone(medicalProfile.alcohol),
            ...(medicalProfile.heightCm === undefined
              ? {}
              : { heightCm: medicalProfile.heightCm }),
            ...(medicalProfile.weightKg === undefined
              ? {}
              : { weightKg: medicalProfile.weightKg }),
          },
        },
      };
      const confirmedSummary: SummaryRecordV1 = {
        ...summary,
        revision: nextRevision,
        status: "confirmed",
        updatedAt: completedAt,
        confirmedAt: completedAt,
      };
      const messages = await requestResult<InterviewMessageRecordV1[]>(
        transaction
          .objectStore("messages")
          .index("byInterviewId")
          .getAll(interview.id),
      );
      transaction.objectStore("interviews").put(completedInterview);
      transaction.objectStore("summaries").put(confirmedSummary);
      transaction.objectStore("interviewDrafts").delete(interview.id);
      await transactionComplete(transaction);
      return {
        interview: completedInterview,
        messages: messages.sort((left, right) => left.sequence - right.sequence),
        summary: confirmedSummary,
      };
    },
    async listCompleted() {
      const transaction = database.transaction(
        ["consents", "interviews"],
        "readonly",
      );
      await requireConsent(transaction);
      const completed = await requestResult<InterviewRecord[]>(
        transaction.objectStore("interviews").index("byStatus").getAll("completed"),
      );
      return completed.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    },
  };
}
