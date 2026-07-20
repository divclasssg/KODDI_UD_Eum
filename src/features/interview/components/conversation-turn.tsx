import type { InterviewTurn } from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";

type ConversationTurnProps = {
  turn: InterviewTurn;
};

export function ConversationTurn({ turn }: ConversationTurnProps) {
  return (
    <article className={styles["conversation-turn"]}>
      <p className={styles["past-question"]}>{turn.question}</p>
      <p className={styles["confirmed-answer"]}>{turn.answer}</p>
    </article>
  );
}
