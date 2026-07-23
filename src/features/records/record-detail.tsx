"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { buildProfileEditHref } from "@/features/profile/profile-navigation";
import { useProfileSaveSuccessAnnouncement } from "@/features/profile/profile-save-announcement";

import {
  loadRecordDetail,
  type RecordDetailState,
} from "./load-records";
import type { RecordDetailViewModel } from "./records-view-model";
import styles from "./records.module.scss";

type RecordDetailScreenProps = {
  interviewId: string;
  loadState?: (interviewId: string) => Promise<RecordDetailState>;
  navigate?: (path: string) => void;
};

type ScreenState = RecordDetailState | { status: "loading" };

function SummarySection({
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

function ReadyRecordDetail({ record }: { record: RecordDetailViewModel }) {
  return (
    <>
      <header className={styles.header}>
        <p className={styles.eyebrow}>저장 기록</p>
        <h1>문진 기록</h1>
        <p>
          {record.dateLabel} {record.timeLabel}
        </p>
        <p>
          {record.statusLabel} · {record.modeLabel}
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

      <SummarySection
        items={record.subjective}
        title="S · 사용자가 말한 내용"
      />
      <SummarySection items={record.objective} title="O · 참고 정보" />
      <SummarySection items={record.verificationNeeded} title="확인 필요" />

      <section className={styles.statePanel}>
        <h2>원문 질문과 답변</h2>
        <dl>
          {record.turns.map((turn, index) => (
            <div key={`${index}:${turn.question}`}>
              <dt>{turn.question}</dt>
              <dd>{turn.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {record.clinicianAvailable ? (
        <Link
          className={styles.primaryLink}
          href={`/records/${encodeURIComponent(record.id)}/clinician`}
        >
          의료진에게 보여주기
        </Link>
      ) : (
        <p className={styles.message}>{record.clinicianBlockedMessage}</p>
      )}
      <Link
        className={styles.secondaryLink}
        href={buildProfileEditHref(record.id)}
      >
        내 정보 수정
      </Link>
      <Link className={styles.secondaryLink} href="/records">
        기록 목록으로
      </Link>
    </>
  );
}

export function RecordDetailScreen({
  interviewId,
  loadState = loadRecordDetail,
  navigate,
}: RecordDetailScreenProps) {
  const router = useRouter();
  const navigateWithRouter = useCallback(
    (path: string) => router.replace(path),
    [router],
  );
  const navigateTo = navigate ?? navigateWithRouter;
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const profileSaved = useProfileSaveSuccessAnnouncement();

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
        {profileSaved && (
          <p className={styles.message} role="status">
            변경사항을 저장했어요.
          </p>
        )}

        {state.status === "loading" && (
          <p className={styles.message} role="status">
            기록을 불러오고 있어요.
          </p>
        )}

        {state.status === "missing-database" && (
          <p className={styles.message} role="status">
            온보딩으로 이동하고 있어요.
          </p>
        )}

        {state.status === "not-found" && (
          <div className={styles.statePanel}>
            <h1>기록을 찾을 수 없어요.</h1>
            <Link className={styles.primaryLink} href="/records">
              기록 목록으로
            </Link>
          </div>
        )}

        {state.status === "corrupt" && (
          <div className={styles.statePanel}>
            <h1>이 기록을 안전하게 표시할 수 없어요.</h1>
            <p>저장된 정보가 올바른지 확인할 수 없어요.</p>
            <Link className={styles.primaryLink} href="/records">
              기록 목록으로
            </Link>
            <Link className={styles.secondaryLink} href="/settings/data">
              저장된 정보 모두 삭제
            </Link>
          </div>
        )}

        {state.status === "error" && (
          <div className={styles.statePanel}>
            <p role="alert">기록을 불러오지 못했어요.</p>
            <button className={styles.primary} type="button" onClick={retry}>
              다시 불러오기
            </button>
            <Link className={styles.secondaryLink} href="/records">
              기록 목록으로
            </Link>
          </div>
        )}

        {state.status === "ready" && (
          <ReadyRecordDetail record={state.record} />
        )}
      </section>
    </main>
  );
}
