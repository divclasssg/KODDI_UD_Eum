import { useEffect, useRef } from "react";

import type { InterviewSafetyNotice } from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";

type SafetyNoticeProps = {
  ended: boolean;
  notice: InterviewSafetyNotice;
  onCall119: () => void;
  onContinue: () => void;
  onShowToBystander: () => void;
  onViewSummary: () => void;
};

export function SafetyNotice({
  ended,
  notice,
  onCall119,
  onContinue,
  onShowToBystander,
  onViewSummary,
}: SafetyNoticeProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const urgent = notice.level === "urgent";

  return (
    <section
      aria-live={urgent && !ended ? "assertive" : "polite"}
      className={`${styles.notice} ${urgent ? styles.error : styles.warning}`}
      role={urgent && !ended ? "alert" : "status"}
    >
      <h2 ref={headingRef} tabIndex={-1}>
        {notice.title}
      </h2>
      <p>{notice.description}</p>
      {!ended ? (
        <div className={styles["notice-actions"]}>
          {urgent ? (
            <>
              <button onClick={onCall119} type="button">
                119에 전화하기
              </button>
              <button onClick={onShowToBystander} type="button">
                주변 사람에게 보여주기
              </button>
              <button onClick={onViewSummary} type="button">
                문진 내용 요약 보기
              </button>
            </>
          ) : (
            <button onClick={onContinue} type="button">
              문진 계속하기
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
