"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";

import {
  createInterviewApplicationService,
  type InterviewApplicationService,
} from "@/features/interview/application/interview-application-service";
import { validateDraft } from "@/features/interview/domain/interview-draft";
import type { InterviewDomainState } from "@/features/interview/domain/interview-machine";
import { QuestionInputAdapter } from "@/features/inputs/question-input-adapter";
import { createConsentRepository } from "@/lib/db/consent-repository";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import {
  createInterviewRepository,
  type InterviewRepository,
} from "@/lib/db/interview-repository";
import { browserRuntimeOperations } from "@/lib/runtime/runtime-operation-coordinator";

import { createAiInterviewApplicationRepositoryPort } from "./ai-interview-application-adapter";
import {
  createAiInterviewService,
  createPublicAiHttpClient,
  type AiInterviewRepositoryPort,
} from "./ai-interview-service";
import styles from "./ai-interview-screen.module.scss";

type AiInterviewScreenProps = {
  service: InterviewApplicationService;
};

type AiInterviewScreenWithRouterProps = {
  maximumFollowUps: number;
};

const SAFETY_ACTIONS = [
  "call-119",
  "show-to-bystander",
  "view-summary",
] as const;

const SAFETY_ACTION_LABELS = {
  "call-119": "119에 전화하기",
  "show-to-bystander": "주변 사람에게 보여주기",
  "view-summary": "문진 내용 요약 보기",
} as const;

function blocksUnload(state: InterviewDomainState): boolean {
  return (
    state.phase === "submitting" ||
    state.phase === "completing" ||
    ((state.phase === "waiting-for-question" ||
      state.phase === "waiting-for-summary") &&
      Boolean(state.operation)) ||
    (state.phase === "safety-review" && Boolean(state.operation)) ||
    (state.phase === "answering" && state.draftSync !== "clean")
  );
}

function transitionFocusKey(state: InterviewDomainState): string {
  if (state.phase === "answering") {
    return `answering:${state.question.id}:${state.errorCode ?? "ready"}`;
  }
  if (state.phase === "submitting") {
    return `submitting:${state.question.id}`;
  }
  if (
    state.phase === "waiting-for-question" ||
    state.phase === "waiting-for-summary"
  ) {
    return `${state.phase}:${state.errorCode ?? "pending"}`;
  }
  if (state.phase === "review" || state.phase === "completing") {
    return `${state.phase}:${state.errorCode ?? "ready"}`;
  }
  if (state.phase === "safety-review") {
    return `safety-review:${state.reason}:${state.errorCode ?? "ready"}`;
  }
  return state.phase;
}

function TerminalScreen({
  message,
  service,
  title,
  headingRef,
}: {
  message: string;
  service: InterviewApplicationService;
  title: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p role="status">{message}</p>
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        <button
          className={styles.primary}
          data-action-emphasis="primary"
          onClick={() => service.navigate("/home")}
          type="button"
        >
          홈으로
        </button>
      </section>
    </main>
  );
}

export function AiInterviewScreen({ service }: AiInterviewScreenProps) {
  const [state, setState] = useState(service.getState);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusKey = useRef(transitionFocusKey(state));

  useEffect(() => {
    const nextFocusKey = transitionFocusKey(state);
    if (previousFocusKey.current !== nextFocusKey) {
      headingRef.current?.focus();
    }
    previousFocusKey.current = nextFocusKey;
  }, [state]);

  useEffect(() => {
    const unsubscribe = service.subscribe(setState);
    service.start();
    return () => {
      unsubscribe();
      service.dispose();
    };
  }, [service]);

  useEffect(() => {
    if (!blocksUnload(state)) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [state]);

  if (state.phase === "completed") {
    return (
      <TerminalScreen
        message="문진을 저장했어요."
        service={service}
        title="의료진에게 보여줄 내용을 준비했어요"
        headingRef={headingRef}
      />
    );
  }

  if (state.phase === "safety-stopped") {
    return (
      <TerminalScreen
        message="안전 안내를 확인했어요."
        service={service}
        title="문진을 안전 안내와 함께 종료했어요"
        headingRef={headingRef}
      />
    );
  }

  if (state.phase === "load-error") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 ref={headingRef} tabIndex={-1}>
            AI 문진을 불러오지 못했어요
          </h1>
          <p role="alert">진행 중인 AI 문진을 불러오지 못했어요.</p>
          <button onClick={() => window.location.reload()} type="button">
            다시 불러오기
          </button>
          <button onClick={() => service.navigate("/home")} type="button">
            홈으로
          </button>
        </section>
      </main>
    );
  }

  if (state.phase === "loading" || state.phase === "disposed") {
    return (
      <main className={styles.page} aria-busy="true">
        <section className={styles.card}>
          <h1 ref={headingRef} tabIndex={-1}>
            AI 문진을 불러오고 있어요
          </h1>
          <p role="status">AI 문진을 불러오고 있어요.</p>
        </section>
      </main>
    );
  }

  if (
    state.phase === "waiting-for-question" ||
    state.phase === "waiting-for-summary"
  ) {
    const pending = Boolean(state.operation);
    return (
      <main className={styles.page} aria-busy={pending}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>AI 문진</p>
          {pending ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>
                {state.phase === "waiting-for-question"
                  ? "다음 질문을 준비하고 있어요"
                  : "문진 내용을 정리하고 있어요"}
              </h1>
              <p role="status">
                {state.phase === "waiting-for-question"
                  ? "다음 질문을 준비하고 있어요"
                  : "문진 내용을 정리하고 있어요"}
              </p>
              <p>준비가 끝날 때까지 입력할 수 없어요.</p>
            </>
          ) : (
            <>
              <h1 ref={headingRef} tabIndex={-1}>
                AI 요청을 완료하지 못했어요
              </h1>
              <p role="alert">AI 요청을 완료하지 못했어요.</p>
              <button
                className={styles.primary}
                data-action-emphasis="primary"
                onClick={() => service.retryAi()}
                type="button"
              >
                {state.phase === "waiting-for-question"
                  ? "다시 질문 받기"
                  : "다시 요약하기"}
              </button>
              <button onClick={() => service.navigate("/home")} type="button">
                홈으로
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  if (state.phase === "safety-review") {
    const pending = Boolean(state.operation);
    return (
      <main className={styles.page}>
        <section
          aria-busy={pending}
          aria-live="assertive"
          className={`${styles.card} ${styles.safety}`}
          role="alert"
        >
          <p className={styles.eyebrow}>긴급 안전 안내</p>
          <h1
            ref={state.errorCode ? undefined : headingRef}
            tabIndex={-1}
          >
            지금은 문진보다 안전이 먼저예요
          </h1>
          <p>{state.message}</p>
          {state.errorCode && (
            <h2 ref={headingRef} tabIndex={-1}>
              안전 안내 확인을 저장하지 못했어요. 다시 선택해 주세요.
            </h2>
          )}
          <div className={styles.actionGroup}>
            {SAFETY_ACTIONS.filter((action) =>
              state.actions.includes(action),
            ).map((action) => (
              <button
                className={action === "call-119" ? styles.primary : undefined}
                data-action-emphasis={
                  action === "call-119" ? "primary" : "secondary"
                }
                disabled={pending}
                key={action}
                onClick={() => service.acknowledgeSafety(action)}
                type="button"
              >
                {SAFETY_ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (state.phase === "review" || state.phase === "completing") {
    const pending = state.phase === "completing";
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-busy={pending}>
          <p className={styles.eyebrow}>확인</p>
          <h1
            ref={state.errorCode ? undefined : headingRef}
            tabIndex={-1}
          >
            문진 내용을 확인해 주세요
          </h1>
          <p>
            {state.summary.source === "ai"
              ? "AI가 답변을 정리했어요."
              : "AI 정리에 문제가 있어 입력한 답변을 기준으로 정리했어요."}
          </p>
          <ul className={styles.summary}>
            {state.summary.items.map((item, index) => (
              <li key={`${index}:${item}`}>{item}</li>
            ))}
          </ul>
          <p>이 내용은 진단이나 치료 권고가 아닙니다.</p>
          {state.errorCode && (
            <div role="alert">
              <h2 ref={headingRef} tabIndex={-1}>
                문진을 완료하지 못했어요.
              </h2>
              {" "}
              <p>저장된 답변은 그대로 있어요.</p>
            </div>
          )}
          <button
            className={styles.primary}
            data-action-emphasis="primary"
            disabled={pending}
            onClick={() => service.complete()}
            type="button"
          >
            {pending ? "저장하고 있어요" : "문진 저장 완료"}
          </button>
          <button
            disabled={pending}
            onClick={() => service.navigate("/home")}
            type="button"
          >
            나중에 계속하기
          </button>
        </section>
      </main>
    );
  }

  const pending = state.phase === "submitting";
  const validation = validateDraft(state.question, state.draft);
  const submitQueued = state.phase === "answering" && state.submitQueued;
  const saving = state.phase === "answering" && state.draftSync === "saving";
  const hasError = state.phase === "answering" && Boolean(state.errorCode);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={pending || saving}>
        <p className={styles.eyebrow}>AI 문진</p>
        <h1
          ref={hasError ? undefined : headingRef}
          tabIndex={-1}
        >
          {state.question.text}
        </h1>
        <QuestionInputAdapter
          disabled={pending}
          draft={state.draft}
          onDraftChange={(draft) => service.editDraft(draft)}
          question={state.question}
        />
        {hasError && (
          <div role="alert">
            <h2 ref={headingRef} tabIndex={-1}>답변을 저장하지 못했어요</h2>
            <p>입력한 답변은 그대로 있어요.</p>
          </div>
        )}
        {(saving || pending) && <p role="status">답변을 저장하고 있어요.</p>}
        <button
          className={styles.primary}
          data-action-emphasis="primary"
          disabled={validation.status !== "valid" || pending || submitQueued}
          onClick={() => service.submit()}
          type="button"
        >
          답변 저장
        </button>
        <button
          disabled={pending}
          onClick={() => service.navigate("/home")}
          type="button"
        >
          나중에 계속하기
        </button>
      </section>
    </main>
  );
}

async function withRepository<Value>(
  operation: (repository: InterviewRepository) => Promise<Value>,
) {
  const database = await openMedicalInterviewDatabase();
  try {
    return await operation(
      createInterviewRepository(database, {
        assertRuntimeGeneration: browserRuntimeOperations.assertCurrent,
      }),
    );
  } finally {
    database.close();
  }
}

function createBrowserAiRepository(): AiInterviewRepositoryPort {
  return {
    findOrCreateAi: (input) =>
      withRepository((repository) => repository.findOrCreateAi(input)),
    loadInProgress: (id) =>
      withRepository((repository) => repository.loadInProgress(id)),
    persistDraft: (...args) =>
      withRepository((repository) => repository.persistDraft(...args)),
    saveProgress: (...args) =>
      withRepository((repository) => repository.saveProgress(...args)),
    saveGeneratedQuestion: (...args) =>
      withRepository((repository) =>
        repository.saveGeneratedQuestion(...args),
      ),
    saveSafetyReview: (...args) =>
      withRepository((repository) => repository.saveSafetyReview(...args)),
    saveSummary: (...args) =>
      withRepository((repository) => repository.saveSummary(...args)),
    confirmSafetyStop: (...args) =>
      withRepository((repository) => repository.confirmSafetyStop(...args)),
    complete: (...args) =>
      withRepository((repository) => repository.complete(...args)),
  };
}

async function assertAiTransferConsent(): Promise<void> {
  const database = await openMedicalInterviewDatabase();
  try {
    const consent = await createConsentRepository(database).getCurrent();
    if (consent?.aiTransfer.state !== "granted") {
      throw new Error("ai-transfer-consent-required");
    }
  } finally {
    database.close();
  }
}

function createBrowserAiInterviewApplicationService(
  navigate: (path: "/home") => void,
  maximumFollowUps: number,
) {
  const aiService = createAiInterviewService({
    repository: createBrowserAiRepository(),
    client: createPublicAiHttpClient(),
    assertAiTransferConsent,
    captureRuntimeGeneration: browserRuntimeOperations.capture,
    maximumFollowUps,
  });
  return createInterviewApplicationService({
    repository: createAiInterviewApplicationRepositoryPort({
      service: aiService,
      runtimeCoordinator: browserRuntimeOperations,
    }),
    navigate,
    captureRuntimeGeneration: browserRuntimeOperations.capture,
  });
}

export function AiInterviewScreenWithRouter({
  maximumFollowUps,
}: AiInterviewScreenWithRouterProps) {
  const router = useRouter();
  const navigate = useCallback((path: "/home") => router.push(path), [router]);
  const [service] = useState(() =>
    createBrowserAiInterviewApplicationService(navigate, maximumFollowUps),
  );
  return <AiInterviewScreen service={service} />;
}
