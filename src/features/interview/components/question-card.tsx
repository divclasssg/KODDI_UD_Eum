import { useEffect, useRef } from "react";

import type { InterviewQuestion } from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";

type QuestionCardProps = {
  headingId: string;
  question: InterviewQuestion;
};

export function QuestionCard({ headingId, question }: QuestionCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className={styles["question-card"]}>
      <h1 id={headingId} ref={headingRef} tabIndex={-1}>
        {question.text}
      </h1>
    </section>
  );
}
