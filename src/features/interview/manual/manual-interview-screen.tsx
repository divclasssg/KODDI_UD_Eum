"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createInterviewApplicationService,
  type InterviewApplicationService,
} from "@/features/interview/application/interview-application-service";
import { validateDraft } from "@/features/interview/domain/interview-draft";
import type { InterviewDomainState } from "@/features/interview/domain/interview-machine";
import { QuestionInputAdapter } from "@/features/inputs/question-input-adapter";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import {
  createInterviewRepository,
  type InterviewRepository,
} from "@/lib/db/interview-repository";
import { browserRuntimeOperations } from "@/lib/runtime/runtime-operation-coordinator";

import { createManualInterviewApplicationRepositoryPort } from "./manual-interview-application-adapter";
import { createManualInterviewService } from "./manual-interview-service";
import styles from "./manual-interview-screen.module.scss";

type ManualInterviewScreenProps = {
  service: InterviewApplicationService;
};

function blocksUnload(state: InterviewDomainState): boolean {
  return (
    state.phase === "submitting" ||
    state.phase === "completing" ||
    (state.phase === "answering" && state.draftSync !== "clean")
  );
}

export function ManualInterviewScreen({ service }: ManualInterviewScreenProps) {
  const [state, setState] = useState(service.getState);

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
      <main className={styles.page}>
        <section className={styles.card}>
          <p role="status">문진을 저장했어요.</p>
          <h1>의료진에게 보여줄 내용을 준비했어요</h1>
          <button
            className={styles.primary}
            onClick={() => service.navigate("/home")}
            type="button"
          >
            홈으로
          </button>
        </section>
      </main>
    );
  }
  if (state.phase === "load-error") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p role="alert">진행 중인 문진을 불러오지 못했어요.</p>
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
      <main className={styles.page}>
        <p role="status">문진을 불러오고 있어요.</p>
      </main>
    );
  }
  if (state.phase === "review" || state.phase === "completing") {
    const pending = state.phase === "completing";
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-busy={pending}>
          <p className={styles.eyebrow}>확인</p>
          <h1>작성한 내용을 확인해 주세요</h1>
          <ul className={styles.summary}>
            {state.summary.items.map((item, index) => (
              <li key={`${index}:${item}`}>{item}</li>
            ))}
          </ul>
          <p>이 내용은 입력한 답변만 정리했으며 진단이나 치료 권고가 아닙니다.</p>
          {state.errorCode && (
            <p role="alert">
              문진을 완료하지 못했어요. 저장된 답변은 그대로 있어요.
            </p>
          )}
          <button
            className={styles.primary}
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
        <p className={styles.eyebrow}>수동 문진</p>
        <h1>{state.question.text}</h1>
        <QuestionInputAdapter
          disabled={pending}
          draft={state.draft}
          onDraftChange={(draft) => service.editDraft(draft)}
          question={state.question}
        />
        {hasError && (
          <p role="alert">저장하지 못했어요. 입력한 답변은 그대로 있어요.</p>
        )}
        {(saving || pending) && (
          <p role="status">답변을 저장하고 있어요.</p>
        )}
        <button
          className={styles.primary}
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

function createBrowserManualInterviewApplicationService(
  navigate: (path: "/home") => void,
) {
  const repository = {
    create: (input: Parameters<InterviewRepository["create"]>[0]) =>
      withRepository((current) => current.create(input)),
    findLatestInProgress: (
      mode: Parameters<InterviewRepository["findLatestInProgress"]>[0],
    ) => withRepository((current) => current.findLatestInProgress(mode)),
    upgradeLegacyDraft: (
      ...args: Parameters<InterviewRepository["upgradeLegacyDraft"]>
    ) => withRepository((current) => current.upgradeLegacyDraft(...args)),
    persistDraft: (...args: Parameters<InterviewRepository["persistDraft"]>) =>
      withRepository((current) => current.persistDraft(...args)),
    saveProgress: (...args: Parameters<InterviewRepository["saveProgress"]>) =>
      withRepository((current) => current.saveProgress(...args)),
    saveFinalProgress: (
      ...args: Parameters<InterviewRepository["saveFinalProgress"]>
    ) => withRepository((current) => current.saveFinalProgress(...args)),
    complete: (...args: Parameters<InterviewRepository["complete"]>) =>
      withRepository((current) => current.complete(...args)),
  };
  const legacyService = createManualInterviewService({
    captureRuntimeGeneration: browserRuntimeOperations.capture,
    repository,
  });
  return createInterviewApplicationService({
    repository: createManualInterviewApplicationRepositoryPort({
      legacyService,
      repository,
    }),
    navigate,
    captureRuntimeGeneration: browserRuntimeOperations.capture,
  });
}

export function ManualInterviewScreenWithRouter() {
  const router = useRouter();
  const navigate = useCallback((path: "/home") => router.push(path), [router]);
  const [service] = useState(() =>
    createBrowserManualInterviewApplicationService(navigate),
  );
  return <ManualInterviewScreen service={service} />;
}
