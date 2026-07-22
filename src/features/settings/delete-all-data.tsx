"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { createLocalDataRepository } from "@/lib/db/local-data-repository";
import { browserRuntimeOperations } from "@/lib/runtime/runtime-operation-coordinator";

import styles from "./delete-all-data.module.scss";

type DeleteAllDataProps = {
  reset: () => Promise<void>;
  navigate: (path: string) => void;
};

type DeleteState = "idle" | "confirming" | "deleting" | "success" | "error";

export function DeleteAllData({ reset, navigate }: DeleteAllDataProps) {
  const [state, setState] = useState<DeleteState>("idle");

  const runReset = async () => {
    if (state === "deleting") return;
    setState("deleting");
    try {
      await reset();
      setState("success");
    } catch {
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p role="status">삭제를 완료했어요.</p>
          <h1>이 브라우저에 저장된 정보를 모두 지웠어요</h1>
          <p>삭제한 정보는 복구할 수 없어요.</p>
          <button className={styles.primary} type="button" onClick={() => navigate("/onboarding")}>
            처음부터 시작하기
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={state === "deleting"}>
        <p className={styles.eyebrow}>데이터 관리</p>
        <h1>저장된 정보 모두 삭제</h1>
        <p>프로필, 의료정보, 진행 중 문진과 완료 기록을 이 브라우저에서 모두 삭제합니다.</p>
        <p>삭제한 정보는 복구할 수 없습니다.</p>
        {state === "error" && <p role="alert">삭제하지 못했어요. 저장된 정보는 그대로 있어요.</p>}
        <button className={styles.danger} type="button" disabled={state === "deleting"} onClick={() => state === "error" ? void runReset() : setState("confirming")}>
          {state === "error" ? "다시 시도" : "모든 정보 삭제"}
        </button>
        <button type="button" disabled={state === "deleting"} onClick={() => navigate("/home")}>홈으로</button>
      </section>

      {state === "confirming" && (
        <div className={styles.backdrop}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
            <h2 id="delete-dialog-title">모든 정보를 삭제할까요?</h2>
            <p>프로필과 모든 문진 기록이 영구적으로 삭제됩니다.</p>
            <button className={styles.danger} type="button" onClick={() => void runReset()}>삭제 확인</button>
            <button type="button" onClick={() => setState("idle")}>취소</button>
          </div>
        </div>
      )}
      {state === "deleting" && <p className={styles.floatingStatus} role="status">안전하게 삭제하고 있어요.</p>}
    </main>
  );
}

async function resetWithBrowserDatabase() {
  browserRuntimeOperations.invalidateAndCancel();
  const database = await openMedicalInterviewDatabase();
  try {
    await createLocalDataRepository(database).resetAll();
  } finally {
    database.close();
  }
}

export function DeleteAllDataWithRouter() {
  const router = useRouter();
  const navigate = useCallback((path: string) => router.push(path), [router]);
  return <DeleteAllData reset={resetWithBrowserDatabase} navigate={navigate} />;
}
