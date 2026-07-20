import type { InterviewQuestion } from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";

type ChoiceInputProps = {
  disabled: boolean;
  labelledBy: string;
  onChange: (optionId: string) => void;
  question: InterviewQuestion;
  selectedOptionIds: string[];
};

export function ChoiceInput({
  disabled,
  labelledBy,
  onChange,
  question,
  selectedOptionIds,
}: ChoiceInputProps) {
  const inputType = question.selection === "single" ? "radio" : "checkbox";

  return (
    <fieldset
      aria-labelledby={labelledBy}
      className={styles["choice-input"]}
      disabled={disabled}
    >
      <legend className={styles["visually-hidden"]}>답변 선택</legend>
      {question.options.map((option) => (
        <label className={styles.option} key={option.id}>
          <input
            checked={selectedOptionIds.includes(option.id)}
            name={`choice-${question.id}`}
            onChange={() => onChange(option.id)}
            type={inputType}
            value={option.id}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
