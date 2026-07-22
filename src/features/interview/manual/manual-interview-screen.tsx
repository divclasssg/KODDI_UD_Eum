"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { createInterviewRepository, type InterviewRepository } from "@/lib/db/interview-repository";
import { browserRuntimeOperations } from "@/lib/runtime/runtime-operation-coordinator";

import {
  createManualInterviewService,
  type ManualAnswerDraft,
  type ManualInterviewService,
  type ManualInterviewState,
} from "./manual-interview-service";
import styles from "./manual-interview-screen.module.scss";

type ManualInterviewScreenProps = {
  service: ManualInterviewService;
  navigate: (path: string) => void;
};

export function ManualInterviewScreen({ service, navigate }: ManualInterviewScreenProps) {
  const [state, setState] = useState<ManualInterviewState>();
  const [loadingError, setLoadingError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    service.loadOrCreate()
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch(() => {
        if (active) setLoadingError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, service]);

  const updateAnswer = (value: Partial<ManualAnswerDraft>) => {
    setState((current) => current ? {
      ...current,
      answer: { ...current.answer, ...value },
    } : current);
    setSaveError(false);
  };

  const submit = async () => {
    if (!state || pending) return;
    setPending(true);
    setSaveError(false);
    try {
      setState(await service.saveAnswer(state, state.answer));
    } catch {
      setSaveError(true);
    } finally {
      setPending(false);
    }
  };

  const complete = async () => {
    if (!state || pending) return;
    setPending(true);
    setSaveError(false);
    try {
      await service.complete(state);
      setCompleted(true);
    } catch {
      setSaveError(true);
    } finally {
      setPending(false);
    }
  };

  if (completed) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p role="status">문진을 저장했어요.</p>
          <h1>의료진에게 보여줄 내용을 준비했어요</h1>
          <button className={styles.primary} type="button" onClick={() => navigate("/home")}>홈으로</button>
        </section>
      </main>
    );
  }
  if (loadingError) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p role="alert">진행 중인 문진을 불러오지 못했어요.</p>
          <button type="button" onClick={() => { setLoadingError(false); setAttempt((value) => value + 1); }}>다시 불러오기</button>
          <button type="button" onClick={() => navigate("/home")}>홈으로</button>
        </section>
      </main>
    );
  }
  if (!state) {
    return <main className={styles.page}><p role="status">문진을 불러오고 있어요.</p></main>;
  }

  if (state.phase === "review") {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-busy={pending}>
          <p className={styles.eyebrow}>확인</p>
          <h1>작성한 내용을 확인해 주세요</h1>
          <ul className={styles.summary}>
            {state.aggregate.summary?.content.subjective.map((item) => <li key={item.id}>{item.text}</li>)}
          </ul>
          <p>이 내용은 입력한 답변만 정리했으며 진단이나 치료 권고가 아닙니다.</p>
          {saveError && <p role="alert">문진을 완료하지 못했어요. 저장된 답변은 그대로 있어요.</p>}
          <button className={styles.primary} type="button" disabled={pending} onClick={() => void complete()}>{pending ? "저장하고 있어요" : "문진 저장 완료"}</button>
          <button type="button" disabled={pending} onClick={() => navigate("/home")}>나중에 계속하기</button>
        </section>
      </main>
    );
  }

  const question = state.question;
  if (!question) return null;
  const hasAnswer = state.answer.text.trim() !== "" || state.answer.selectedOptionIds.length > 0;
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={pending}>
        <p className={styles.eyebrow}>수동 문진</p>
        <h1>{question.text}</h1>
        {question.options.length > 0 && (
          <fieldset>
            <legend>답변 선택</legend>
            <div className={styles.options}>
              {question.options.map((option) => (
                <label key={option.id}>
                  <input type="radio" name="manual-answer" checked={state.answer.selectedOptionIds.includes(option.id)} onChange={() => updateAnswer({ selectedOptionIds: [option.id], ...(option.id === "none" ? { text: "" } : {}) })} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {question.inputMode === "text" && (
          <div className={styles.field}>
            <label htmlFor="manual-answer">답변</label>
            <textarea id="manual-answer" value={state.answer.text} disabled={state.answer.selectedOptionIds.includes("none")} onChange={(event) => updateAnswer({ text: event.target.value, selectedOptionIds: [] })} />
          </div>
        )}
        {saveError && <p role="alert">저장하지 못했어요. 입력한 답변은 그대로 있어요.</p>}
        {pending && <p role="status">답변을 저장하고 있어요.</p>}
        <button className={styles.primary} type="button" disabled={!hasAnswer || pending} onClick={() => void submit()}>답변 저장</button>
        <button type="button" disabled={pending} onClick={() => navigate("/home")}>나중에 계속하기</button>
      </section>
    </main>
  );
}

async function withRepository<Value>(
  operation: (repository: InterviewRepository) => Promise<Value>,
) {
  const database = await openMedicalInterviewDatabase();
  try {
    return await operation(createInterviewRepository(database, {
      assertRuntimeGeneration: browserRuntimeOperations.assertCurrent,
    }));
  } finally {
    database.close();
  }
}

function createBrowserManualInterviewService() {
  return createManualInterviewService({
    captureRuntimeGeneration: browserRuntimeOperations.capture,
    repository: {
      create: (input) => withRepository((repository) => repository.create(input)),
      findLatestInProgress: (mode) => withRepository((repository) => repository.findLatestInProgress(mode)),
      saveProgress: (token, input) => withRepository((repository) => repository.saveProgress(token, input)),
      saveFinalProgress: (token, input) => withRepository((repository) => repository.saveFinalProgress(token, input)),
      complete: (token) => withRepository((repository) => repository.complete(token)),
    },
  });
}

export function ManualInterviewScreenWithRouter() {
  const router = useRouter();
  const navigate = useCallback((path: string) => router.push(path), [router]);
  const [service] = useState(createBrowserManualInterviewService);
  return <ManualInterviewScreen service={service} navigate={navigate} />;
}
