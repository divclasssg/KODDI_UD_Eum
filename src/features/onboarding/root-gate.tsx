"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { hasMedicalInterviewDatabase } from "@/lib/db/database-presence";
import {
  loadHomeState,
  type HomeState,
} from "@/features/home/load-home-state";

import styles from "./root-gate.module.scss";

type RootGateProps = {
  loadDestination: () => Promise<RootDestination>;
  navigate: (path: string) => void;
};

export type RootDestination = "home" | "onboarding" | "recovery";

type RootDestinationDependencies = {
  hasDatabase?: () => Promise<boolean>;
  loadHome?: () => Promise<HomeState>;
};

export async function loadRootDestination({
  hasDatabase = hasMedicalInterviewDatabase,
  loadHome = loadHomeState,
}: RootDestinationDependencies = {}): Promise<RootDestination> {
  if (!(await hasDatabase())) return "onboarding";
  const homeState = await loadHome();
  return homeState.status === "ready" ? "home" : "recovery";
}

export function RootGate({ loadDestination, navigate }: RootGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadDestination()
      .then((destination) => {
        if (!active) return;
        if (destination === "recovery") {
          setFailed(true);
          return;
        }
        navigate(destination === "home" ? "/home" : "/onboarding");
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, loadDestination, navigate]);

  const retry = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {failed ? (
          <>
            <p role="alert">저장된 정보를 확인하지 못했어요.</p>
            <button type="button" onClick={retry}>
              다시 확인하기
            </button>
            <button type="button" onClick={() => navigate("/onboarding")}>
              온보딩 다시 시작하기
            </button>
          </>
        ) : (
          <p role="status">저장된 정보를 확인하고 있어요.</p>
        )}
      </section>
    </main>
  );
}

export function RootGateWithRouter() {
  const router = useRouter();
  const navigate = useCallback((path: string) => router.replace(path), [router]);

  return (
    <RootGate
      loadDestination={loadRootDestination}
      navigate={navigate}
    />
  );
}
