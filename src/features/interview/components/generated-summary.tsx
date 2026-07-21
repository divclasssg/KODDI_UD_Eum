import type { InterviewSummary } from "../model/interview-domain.types";
import styles from "../interview-screen.module.scss";

type GeneratedSummaryProps = {
  summary: InterviewSummary;
};

const SECTIONS = [
  ["주관적 정보", "subjective"],
  ["객관적 정보", "objective"],
  ["확인이 필요한 정보", "verificationNeeded"],
] as const;

export function GeneratedSummary({ summary }: GeneratedSummaryProps) {
  return (
    <article className={styles["generated-summary"]}>
      {SECTIONS.map(([heading, key]) => (
        <section key={key}>
          <h2>{heading}</h2>
          {summary[key].length > 0 ? (
            <ul>
              {summary[key].map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          ) : (
            <p>기록 없음</p>
          )}
        </section>
      ))}
    </article>
  );
}
