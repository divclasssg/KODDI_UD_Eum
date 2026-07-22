import { useEffect, useRef } from "react";

import type { InterviewError } from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";

type ErrorNoticeProps = {
  error: InterviewError;
  onContinueManually: () => void;
  onRetryAi: () => void;
  onRetrySave: () => void;
};

export function ErrorNotice({
  error,
  onContinueManually,
  onRetryAi,
  onRetrySave,
}: ErrorNoticeProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-live="assertive"
      className={`${styles.notice} ${styles.error}`}
      role="alert"
    >
      <h2 ref={headingRef} tabIndex={-1}>
        {error.title}
      </h2>
      <p>{error.description}</p>
      <div className={styles["notice-actions"]}>
        {error.kind === "save" ? (
          <button
            className={styles["notice-primary-action"]}
            data-action-emphasis="primary"
            onClick={onRetrySave}
            type="button"
          >
            다시 저장하기
          </button>
        ) : (
          <>
            <button
              className={styles["notice-primary-action"]}
              data-action-emphasis="primary"
              onClick={onRetryAi}
              type="button"
            >
              다시 질문 받기
            </button>
            <button
              className={styles["notice-secondary-action"]}
              data-action-emphasis="secondary"
              onClick={onContinueManually}
              type="button"
            >
              수동 문진으로 계속
            </button>
          </>
        )}
      </div>
    </section>
  );
}
