"use client";

import { useState } from "react";

import { ConversationViewport } from "./components/conversation-viewport";
import { AsyncStatus } from "./components/async-status";
import { ErrorNotice } from "./components/error-notice";
import { ResponseComposer } from "./components/response-composer";
import { GeneratedSummary } from "./components/generated-summary";
import { RoleplayConfirmation } from "./components/roleplay-confirmation";
import { SafetyNotice } from "./components/safety-notice";
import type {
  InterviewDraft,
  InterviewViewModel,
} from "./model/interview-ui.types";
import styles from "./interview-screen.module.scss";
import type { InterviewControllerActions } from "./use-interview-controller";

export type InterviewCommands = {
  submit(draft: InterviewDraft): Promise<void> | void;
};

type InterviewScreenProps = {
  actions?: InterviewControllerActions;
  commands: InterviewCommands;
  initialModel: InterviewViewModel;
  showSavingStatus?: boolean;
};

const LOCKED_STATES = new Set<InterviewViewModel["state"]>([
  "saving",
  "waiting-for-ai",
  "urgent",
  "summary-transition",
  "summary-ready",
  "safe-ended",
]);

function cloneDraft(draft: InterviewDraft): InterviewDraft {
  return { ...draft, selectedOptionIds: [...draft.selectedOptionIds] };
}

export function InterviewScreen({
  actions,
  commands,
  initialModel,
  showSavingStatus = false,
}: InterviewScreenProps) {
  const [draft, setDraft] = useState(() => cloneDraft(initialModel.draft));
  const [submittedQuestionId, setSubmittedQuestionId] = useState<string>();
  const question = initialModel.question;
  const headingId = question ? `interview-question-${question.id}` : undefined;
  const inputDisabled =
    !initialModel.roleplayConfirmed ||
    LOCKED_STATES.has(initialModel.state) ||
    (initialModel.state === "answering" &&
      question !== undefined &&
      submittedQuestionId === question.id);
  const submitDisabled = inputDisabled || initialModel.state !== "answering";

  const toggleOption = (optionId: string) => {
    if (!question) return;

    setDraft((current) => ({
      ...current,
      inputMode: "choice",
      selectedOptionIds:
        question.selection === "single"
          ? [optionId]
          : current.selectedOptionIds.includes(optionId)
            ? current.selectedOptionIds.filter((id) => id !== optionId)
            : [...current.selectedOptionIds, optionId],
    }));
  };

  const submit = () => {
    if (!question || submitDisabled) return;

    const submittedDraft = cloneDraft(draft);
    const hasAnswer =
      submittedDraft.selectedOptionIds.length > 0 ||
      submittedDraft.text.trim().length > 0;
    if (!hasAnswer) return;

    setSubmittedQuestionId(question.id);
    try {
      void Promise.resolve(commands.submit(submittedDraft)).catch(() => {
        setSubmittedQuestionId(undefined);
      });
    } catch {
      setSubmittedQuestionId(undefined);
    }
  };

  return (
    <section className={styles.screen}>
      <ConversationViewport
        headingId={headingId}
        history={initialModel.history}
        question={question}
      />
      {initialModel.pending &&
      (initialModel.pending.kind !== "saving" || showSavingStatus) ? (
        <AsyncStatus title={initialModel.pending.title} />
      ) : null}
      {initialModel.summary ? (
        <AsyncStatus
          description={initialModel.summary.description}
          title={initialModel.summary.title}
        />
      ) : null}
      {initialModel.generatedSummary ? (
        <GeneratedSummary summary={initialModel.generatedSummary} />
      ) : null}
      {initialModel.error ? (
        <ErrorNotice
          error={initialModel.error}
          onContinueManually={() => actions?.continueManually()}
          onRetryAi={() => actions?.retryAi()}
          onRetrySave={() => actions?.retrySave(draft)}
        />
      ) : null}
      {initialModel.safety ? (
        <SafetyNotice
          ended={initialModel.state === "safe-ended"}
          notice={initialModel.safety}
          onCall119={() => actions?.requestSafetyHelp("call-119")}
          onContinue={() => actions?.continueInterview()}
          onShowToBystander={() =>
            actions?.requestSafetyHelp("show-to-bystander")
          }
          onViewSummary={() => actions?.viewSummary()}
        />
      ) : null}
      {question && headingId ? (
        <>
          <RoleplayConfirmation
            checked={initialModel.roleplayConfirmed}
            onChange={(checked) => actions?.setRoleplayConfirmed(checked)}
          />
          <ResponseComposer
            draft={draft}
            headingId={headingId}
            inputDisabled={inputDisabled}
            onSubmit={submit}
            onTextChange={(text) => {
              setDraft((current) => ({ ...current, inputMode: "text", text }));
            }}
            onToggleOption={toggleOption}
            onVoiceSelect={() => {
              setDraft((current) => ({ ...current, inputMode: "voice" }));
            }}
            question={question}
            submitEmphasis={
              initialModel.state === "answering" ? "primary" : "secondary"
            }
            submitDisabled={submitDisabled}
          />
        </>
      ) : null}
    </section>
  );
}
