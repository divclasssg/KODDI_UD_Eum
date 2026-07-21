import { ArrowUpIcon } from "@/components/icons/ArrowUpIcon";

import type {
  InterviewDraft,
  InterviewQuestion,
} from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";
import { ChoiceInput } from "./choice-input";
import { TextInput } from "./text-input";

type ResponseComposerProps = {
  draft: InterviewDraft;
  headingId: string;
  inputDisabled: boolean;
  onSubmit: () => void;
  onTextChange: (text: string) => void;
  onToggleOption: (optionId: string) => void;
  onVoiceSelect: () => void;
  question: InterviewQuestion;
  submitDisabled: boolean;
};

export function ResponseComposer({
  draft,
  headingId,
  inputDisabled,
  onSubmit,
  onTextChange,
  onToggleOption,
  onVoiceSelect,
  question,
  submitDisabled,
}: ResponseComposerProps) {
  const hasAnswer =
    draft.selectedOptionIds.length > 0 || draft.text.trim().length > 0;
  const helperId = `answer-helper-${question.id}`;

  return (
    <form
      className={styles["response-composer"]}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <ChoiceInput
        disabled={inputDisabled}
        labelledBy={headingId}
        onChange={onToggleOption}
        question={question}
        selectedOptionIds={draft.selectedOptionIds}
      />
      <TextInput
        disabled={inputDisabled}
        draft={draft}
        onTextChange={onTextChange}
        onVoiceSelect={onVoiceSelect}
      />
      <p className={styles["roleplay-reminder"]}>
        가상 인물의 입장에서만 답하고 실제 개인정보·건강정보를 입력하지 마세요.
      </p>
      <p className={styles.helper} id={helperId}>
        {hasAnswer ? "답변을 확인한 뒤 다음을 눌러 주세요." : "답변을 선택하거나 입력해 주세요."}
      </p>
      <button
        aria-describedby={helperId}
        className={styles["submit-button"]}
        disabled={submitDisabled || !hasAnswer}
        type="submit"
      >
        <span>다음</span>
        <ArrowUpIcon weight="bold" />
      </button>
    </form>
  );
}
