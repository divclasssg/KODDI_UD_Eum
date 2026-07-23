"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useProfileSaveSuccessAnnouncement } from "@/features/profile/profile-save-announcement";

import { loadHomeState, type HomeState } from "./load-home-state";
import styles from "./home-screen.module.scss";

type HomeScreenProps = {
  loadState: () => Promise<HomeState>;
  navigate: (path: string) => void;
};

export function HomeScreen({ loadState, navigate }: HomeScreenProps) {
  const [state, setState] = useState<HomeState | { status: "loading" }>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const profileSaved = useProfileSaveSuccessAnnouncement();

  useEffect(() => {
    let active = true;
    loadState().then((result) => {
      if (!active) return;
      if (result.status === "missing") {
        navigate("/onboarding");
        return;
      }
      setState(result);
    });
    return () => {
      active = false;
    };
  }, [attempt, loadState, navigate]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  if (state.status === "loading" || state.status === "missing") {
    return (
      <main className={styles.page}>
        <p role="status">저장된 정보를 불러오고 있어요.</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p role="alert">저장된 정보를 불러오지 못했어요.</p>
          <button type="button" onClick={retry}>
            다시 불러오기
          </button>
          <button type="button" onClick={() => navigate("/onboarding")}>
            온보딩 다시 시작하기
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {profileSaved && <p role="status">변경사항을 저장했어요.</p>}
        <p className={styles.eyebrow}>나의 문진</p>
        <h1>{state.displayName}님, 안녕하세요</h1>
        <p>오늘 불편한 점을 차근차근 정리해 보세요.</p>

        {state.aiTransfer === "declined" ? (
          <div className={styles.actionGroup}>
            <p>외부 AI로 정보를 보내지 않아요.</p>
            <button
              className={styles.primary}
              data-action-emphasis="primary"
              type="button"
              onClick={() => navigate("/interview/manual")}
            >
              수동 문진 시작하기
            </button>
          </div>
        ) : (
          <div className={styles.actionGroup}>
            <button
              className={styles.primary}
              data-action-emphasis="primary"
              type="button"
              onClick={() => navigate("/interview/ai")}
            >
              AI 문진 시작하기
            </button>
            <button type="button" onClick={() => navigate("/interview/manual")}>
              수동 문진 시작하기
            </button>
          </div>
        )}
        <button
          className={styles.recordsAction}
          type="button"
          onClick={() => navigate("/records")}
        >
          기록 보기
        </button>
        <p className={styles.notice}>
          {state.aiTransfer === "declined"
            ? "수동 문진은 외부 AI로 정보를 보내지 않고 이 브라우저에 저장돼요."
            : "문진 내용은 이 브라우저에 저장돼요. AI 문진은 동의한 정보만 안전하게 전송해요."}
        </p>
        <div className={styles.managementGroup}>
          <button type="button" onClick={() => navigate("/profile")}>
            프로필 수정
          </button>
          <button type="button" onClick={() => navigate("/settings/data")}>
            저장된 정보 모두 삭제
          </button>
        </div>
      </section>
    </main>
  );
}

export function HomeScreenWithRouter() {
  const router = useRouter();
  const navigate = useCallback((path: string) => router.replace(path), [router]);
  return <HomeScreen loadState={loadHomeState} navigate={navigate} />;
}
