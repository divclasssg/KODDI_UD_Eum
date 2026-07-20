"use client";

import { useRef } from "react";

import type {
  InterviewQuestion,
  InterviewTurn,
} from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";
import { ConversationTurn } from "./conversation-turn";
import { QuestionCard } from "./question-card";

type ConversationViewportProps = {
  headingId?: string;
  history: InterviewTurn[];
  question?: InterviewQuestion;
};

export function ConversationViewport({
  headingId,
  history,
  question,
}: ConversationViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const jumpToLatest = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ behavior: "smooth", top: viewport.scrollHeight });
    if (headingId) {
      document.getElementById(headingId)?.focus();
    }
  };

  return (
    <div className={styles["conversation-container"]}>
      <div
        aria-label="문진 대화"
        aria-live="off"
        className={styles["conversation-viewport"]}
        ref={viewportRef}
        role="log"
      >
        {history.map((turn) => (
          <ConversationTurn key={turn.id} turn={turn} />
        ))}
        {question && headingId ? (
          <QuestionCard headingId={headingId} question={question} />
        ) : null}
      </div>
      {history.length >= 5 ? (
        <button
          className={styles["jump-to-latest"]}
          onClick={jumpToLatest}
          type="button"
        >
          최신 질문으로 이동
        </button>
      ) : null}
    </div>
  );
}
