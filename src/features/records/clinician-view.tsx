"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  loadRecordDetail,
  type RecordDetailState,
} from "./load-records";
import type { RecordDetailViewModel } from "./records-view-model";
import styles from "./records.module.scss";

type ClinicianViewScreenProps = {
  interviewId: string;
  loadState?: (interviewId: string) => Promise<RecordDetailState>;
  navigate?: (path: string) => void;
};

type ScreenState = RecordDetailState | { status: "loading" };

function ClinicianSummarySection({
  items,
  title,
}: {
  items: readonly string[];
  title: string;
}) {
  return (
    <section className={styles.statePanel}>
      <h2>{title}</h2>
      <ul>
        {items.map((item, index) => (
          <li key={`${index}:${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ReadyClinicianView({ record }: { record: RecordDetailViewModel }) {
  return (
    <>
      <header className={styles.header}>
        <p className={styles.eyebrow}>의료진 참고용</p>
        <h1>의료진 참고용</h1>
        <p>진단이나 치료 안내가 아닙니다.</p>
        <p>
          {record.dateLabel} {record.timeLabel} · {record.modeLabel}
        </p>
        {record.summarySourceLabel && <p>{record.summarySourceLabel}</p>}
      </header>

      {record.safetyMessages.length > 0 && (
        <section className={styles.statePanel}>
          <h2>안전 안내</h2>
          <ul>
            {record.safetyMessages.map((message, index) => (
              <li key={`${index}:${message}`}>{message}</li>
            ))}
          </ul>
        </section>
      )}

      <ClinicianSummarySection
        items={record.subjective}
        title="S · 사용자가 말한 내용"
      />
      <section className={styles.statePanel}>
        <h2>O · 참고 정보</h2>
        <p>사용자가 제공한 참고 정보이며 의료진 확인이 필요합니다.</p>
        <ul>
          {record.objective.map((item, index) => (
            <li key={`${index}:${item}`}>{item}</li>
          ))}
        </ul>
      </section>
      <ClinicianSummarySection
        items={record.verificationNeeded}
        title="확인 필요"
      />

      <details className={styles.statePanel}>
        <summary className={styles.sourceToggle}>
          원문 질문과 답변
        </summary>
        <dl>
          {record.turns.map((turn, index) => (
            <div key={`${index}:${turn.question}`}>
              <dt>{turn.question}</dt>
              <dd>{turn.answer}</dd>
            </div>
          ))}
        </dl>
      </details>

      <Link
        className={styles.primaryLink}
        href={`/records/${encodeURIComponent(record.id)}`}
      >
        기록 상세로 돌아가기
      </Link>
    </>
  );
}

function BlockedClinicianView({ interviewId }: { interviewId: string }) {
  return (
    <div className={styles.statePanel}>
      <h1>의료진용 화면을 열 수 없어요.</h1>
      <p>완료하고 확인한 문진 기록만 표시할 수 있어요.</p>
      <Link
        className={styles.primaryLink}
        href={`/records/${encodeURIComponent(interviewId)}`}
      >
        기록 상세로 돌아가기
      </Link>
    </div>
  );
}

export function ClinicianViewScreen({
  interviewId,
  loadState = loadRecordDetail,
  navigate,
}: ClinicianViewScreenProps) {
  const router = useRouter();
  const navigateWithRouter = useCallback(
    (path: string) => router.replace(path),
    [router],
  );
  const navigateTo = navigate ?? navigateWithRouter;
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void loadState(interviewId).then(
      (result) => {
        if (!active) return;
        setState(result);
        if (result.status === "missing-database") {
          navigateTo("/onboarding");
        }
      },
      () => {
        if (active) setState({ status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, interviewId, loadState, navigateTo]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={state.status === "loading"}>
        {state.status === "loading" && (
          <p className={styles.message} role="status">
            의료진용 화면을 불러오고 있어요.
          </p>
        )}

        {state.status === "missing-database" && (
          <p className={styles.message} role="status">
            온보딩으로 이동하고 있어요.
          </p>
        )}

        {(state.status === "not-found" ||
          state.status === "corrupt" ||
          (state.status === "ready" && !state.record.clinicianAvailable)) && (
          <BlockedClinicianView interviewId={interviewId} />
        )}

        {state.status === "error" && (
          <div className={styles.statePanel}>
            <p role="alert">의료진용 화면을 불러오지 못했어요.</p>
            <button className={styles.primary} type="button" onClick={retry}>
              다시 불러오기
            </button>
            <Link
              className={styles.secondaryLink}
              href={`/records/${encodeURIComponent(interviewId)}`}
            >
              기록 상세로 돌아가기
            </Link>
          </div>
        )}

        {state.status === "ready" && state.record.clinicianAvailable && (
          <ReadyClinicianView record={state.record} />
        )}
      </section>
    </main>
  );
}
