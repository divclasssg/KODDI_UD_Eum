"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  loadRecordsList,
  type RecordsListState,
} from "./load-records";
import {
  recordIdFromListHash,
  recordListAnchorId,
} from "./record-list-navigation";
import styles from "./records.module.scss";

type RecordListScreenProps = {
  loadState?: () => Promise<RecordsListState>;
  navigate?: (path: string) => void;
};

type ScreenState = RecordsListState | { status: "loading" };

export function RecordListScreen({
  loadState = loadRecordsList,
  navigate,
}: RecordListScreenProps = {}) {
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

    void loadState().then(
      (result) => {
        if (!active) return;
        setState(result);
        if (result.status === "missing") {
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
  }, [attempt, loadState, navigateTo]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const interviewId = recordIdFromListHash(window.location.hash);
    if (
      !interviewId ||
      !state.records.some((record) => record.id === interviewId)
    ) {
      return;
    }
    const target = document.getElementById(recordListAnchorId(interviewId));
    if (!(target instanceof HTMLAnchorElement)) return;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  }, [state]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={state.status === "loading"}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>저장 기록</p>
          <h1>나의 문진 기록</h1>
          <p>이 브라우저에 저장된 문진을 다시 확인할 수 있어요.</p>
        </header>

        {state.status === "loading" && (
          <p className={styles.message} role="status">
            기록을 불러오고 있어요.
          </p>
        )}

        {state.status === "missing" && (
          <p className={styles.message} role="status">
            온보딩으로 이동하고 있어요.
          </p>
        )}

        {state.status === "error" && (
          <div className={styles.statePanel}>
            <p role="alert">기록을 불러오지 못했어요.</p>
            <p>잠시 후 다시 시도해 주세요.</p>
            <button className={styles.primary} type="button" onClick={retry}>
              다시 불러오기
            </button>
            <Link className={styles.secondaryLink} href="/">
              홈으로
            </Link>
          </div>
        )}

        {state.status === "ready" && state.records.length === 0 && (
          <div className={styles.statePanel}>
            <p className={styles.stateTitle}>기록이 아직 없어요.</p>
            <p>새 문진을 시작하면 이곳에서 다시 확인할 수 있어요.</p>
            <Link className={styles.primaryLink} href="/home">
              새 문진 시작하기
            </Link>
            <Link className={styles.secondaryLink} href="/">
              홈으로
            </Link>
          </div>
        )}

        {state.status === "ready" && state.records.length > 0 && (
          <ul className={styles.list}>
            {state.records.map((record) => (
              <li key={record.id}>
                <Link
                  className={styles.recordLink}
                  href={`/records/${encodeURIComponent(record.id)}`}
                  id={recordListAnchorId(record.id)}
                >
                  <span className={styles.recordMeta}>
                    <span>{record.dateLabel}</span>
                    <span>{record.timeLabel}</span>
                  </span>
                  <span className={styles.labels}>
                    <span>{record.statusLabel}</span>
                    <span>{record.modeLabel}</span>
                  </span>
                  <span className={styles.complaint}>
                    {record.chiefComplaint}
                  </span>
                  <span className={styles.openLabel}>기록 열기</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
