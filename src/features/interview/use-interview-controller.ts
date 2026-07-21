import { useCallback, useEffect, useRef, useState } from "react";

import { DirectIdentifierInputError } from "./http-interview-commands";
import type { InterviewCommandsPort } from "./interview-commands";
import type { InterviewCommands } from "./interview-screen";
import type {
  InterviewDraft,
  InterviewQuestion,
  InterviewTurn,
  InterviewViewModel,
} from "./model/interview-ui.types";

export type InterviewControllerActions = {
  continueInterview(): void;
  continueManually(): void;
  requestSafetyHelp(action: "call-119" | "show-to-bystander"): void;
  retryAi(): void;
  retrySave(draft: InterviewDraft): void;
  setRoleplayConfirmed(confirmed: boolean): void;
  viewSummary(): void;
};

const EMPTY_DRAFT: InterviewDraft = {
  selectedOptionIds: [],
  text: "",
  inputMode: "choice",
};

const MANUAL_QUESTION: InterviewQuestion = {
  id: "question-manual-continuity",
  slot: "pattern",
  text: "증상이 지금도 계속되고 있나요?",
  selection: "single",
  options: [
    { id: "yes", label: "예" },
    { id: "no", label: "아니요" },
    { id: "unknown", label: "잘 모르겠어요" },
  ],
};

function cloneDraft(draft: InterviewDraft): InterviewDraft {
  return { ...draft, selectedOptionIds: [...draft.selectedOptionIds] };
}

export function createDeterministicSummaryV1(history: InterviewTurn[]) {
  return {
    subjective: history.map((turn) => ({
      id: `fallback-v1-${turn.id}`,
      text: turn.answer,
      evidenceTurnIds: [turn.id],
    })),
    objective: [],
    verificationNeeded: [],
  };
}

export function useInterviewController(
  initialModel: InterviewViewModel,
  adapter: InterviewCommandsPort,
) {
  const [model, setModel] = useState(initialModel);
  const [showSavingStatus, setShowSavingStatus] = useState(
    initialModel.state === "saving",
  );
  const activeRequest = useRef(0);
  const inFlight = useRef(false);
  const savingStatusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    return () => {
      activeRequest.current += 1;
      adapter.dispose?.();
      if (savingStatusTimer.current) clearTimeout(savingStatusTimer.current);
    };
  }, [adapter]);

  const runSummary = useCallback(
    async (history: InterviewTurn[], requestId: number) => {
      setModel((current) => ({
        ...current,
        state: "summary-transition",
        history,
        question: undefined,
        pending: undefined,
        error: undefined,
        summary: {
          title: "문진 내용을 정리하고 있어요",
          description: "잠시만 기다려 주세요.",
        },
      }));

      let generatedSummary;
      try {
        generatedSummary = await adapter.requestSummary(history);
      } catch {
        generatedSummary = createDeterministicSummaryV1(history);
      }
      if (activeRequest.current !== requestId) return;

      setModel((current) => ({
        ...current,
        state: "summary-ready",
        summary: undefined,
        generatedSummary,
      }));
    },
    [adapter],
  );

  const runAi = useCallback(
    async (history: InterviewTurn[], requestId: number) => {
      setModel((current) => ({
        ...current,
        state: "waiting-for-ai",
        history,
        question: undefined,
        pending: { kind: "ai", title: "다음 질문을 준비하고 있어요" },
        error: undefined,
      }));

      try {
        const result = await adapter.requestNext(history);
        if (activeRequest.current !== requestId) return;

        if (result.kind === "complete") {
          await runSummary(history, requestId);
          return;
        }

        setModel((current) => ({
          ...current,
          state: "answering",
          question: result.question,
          draft: cloneDraft(EMPTY_DRAFT),
          pending: undefined,
          error: undefined,
        }));
      } catch {
        if (activeRequest.current !== requestId) return;
        setModel((current) => ({
          ...current,
          state: "ai-error",
          question: undefined,
          pending: undefined,
          error: {
            kind: "ai",
            title: "다음 질문을 불러오지 못했어요",
            description: "저장한 답변은 남아 있어요.",
          },
        }));
      } finally {
        if (activeRequest.current === requestId) inFlight.current = false;
      }
    },
    [adapter, runSummary],
  );

  const runSave = useCallback(
    async (question: InterviewQuestion, draft: InterviewDraft) => {
      if (inFlight.current) return;

      inFlight.current = true;
      const requestId = activeRequest.current + 1;
      activeRequest.current = requestId;
      const savedDraft = cloneDraft(draft);
      setShowSavingStatus(false);
      setModel((current) => ({
        ...current,
        state: "saving",
        draft: savedDraft,
        pending: { kind: "saving", title: "답변을 저장하고 있어요" },
        error: undefined,
      }));
      savingStatusTimer.current = setTimeout(() => {
        if (activeRequest.current === requestId) setShowSavingStatus(true);
      }, 300);

      try {
        const savedTurn = await adapter.saveAnswer({
          draft: savedDraft,
          interviewId: model.interviewId,
          question,
        });
        if (activeRequest.current !== requestId) return;
        if (savingStatusTimer.current) clearTimeout(savingStatusTimer.current);
        setShowSavingStatus(false);
        const history = [...model.history, savedTurn];
        await runAi(history, requestId);
      } catch (error) {
        if (activeRequest.current !== requestId) return;
        if (savingStatusTimer.current) clearTimeout(savingStatusTimer.current);
        setShowSavingStatus(false);
        inFlight.current = false;
        setModel((current) => ({
          ...current,
          state: "save-error",
          draft: savedDraft,
          pending: undefined,
          error: {
            kind: "save",
            title:
              error instanceof DirectIdentifierInputError
                ? "실제 정보를 지워 주세요"
                : "답변을 저장하지 못했어요",
            description:
              error instanceof DirectIdentifierInputError
                ? "가상 인물의 정보만 남긴 뒤 다시 저장해 주세요."
                : "입력한 내용은 그대로 있어요. 다시 저장해 주세요.",
          },
        }));
      }
    },
    [adapter, model.history, model.interviewId, runAi],
  );

  const submit = useCallback<InterviewCommands["submit"]>(
    (draft) => {
      if (
        !model.roleplayConfirmed ||
        !model.question ||
        model.state !== "answering"
      ) {
        return;
      }
      return runSave(model.question, draft);
    },
    [model.question, model.roleplayConfirmed, model.state, runSave],
  );

  const actions: InterviewControllerActions = {
    continueInterview() {
      setModel((current) => ({
        ...current,
        state: "answering",
        safety: undefined,
      }));
    },
    continueManually() {
      setModel((current) => ({
        ...current,
        state: "answering",
        question: {
          ...MANUAL_QUESTION,
          options: MANUAL_QUESTION.options.map((option) => ({ ...option })),
        },
        draft: cloneDraft(EMPTY_DRAFT),
        error: undefined,
      }));
    },
    requestSafetyHelp(action) {
      adapter.recordSafetyAction(action);
      setModel((current) => ({
        ...current,
        state: "safe-ended",
        question: undefined,
        safety: {
          level: "urgent",
          title: "도움을 요청하는 행동을 확인했어요",
          description: "안전한 곳에서 주변 사람과 함께 기다려 주세요.",
        },
      }));
    },
    retryAi() {
      if (inFlight.current) return;
      inFlight.current = true;
      const requestId = activeRequest.current + 1;
      activeRequest.current = requestId;
      void runAi(model.history, requestId);
    },
    retrySave(draft) {
      if (!model.question) return;
      void runSave(model.question, draft);
    },
    setRoleplayConfirmed(confirmed) {
      if (inFlight.current) return;
      setModel((current) => ({ ...current, roleplayConfirmed: confirmed }));
    },
    viewSummary() {
      adapter.recordSafetyAction("view-summary");
      if (inFlight.current) return;
      inFlight.current = true;
      const requestId = activeRequest.current + 1;
      activeRequest.current = requestId;
      void runSummary(model.history, requestId).finally(() => {
        if (activeRequest.current === requestId) inFlight.current = false;
      });
    },
  };

  return {
    actions,
    model,
    screenCommands: { submit },
    showSavingStatus,
  };
}
