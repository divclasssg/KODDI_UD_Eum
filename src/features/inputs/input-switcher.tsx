import type { InputModeV2, QuestionSnapshotV2 } from "../interview/domain/interview-draft";
import styles from "./input-adapters.module.scss";

type InputSwitcherProps = {
  activeMode: InputModeV2;
  disabled: boolean;
  onChange: (mode: InputModeV2) => void;
  question: QuestionSnapshotV2;
};

function modeLabel(question: QuestionSnapshotV2, mode: InputModeV2): string {
  if (mode === "text") return "직접 입력";
  if (mode === "measurement") return "측정값 입력";
  if (mode === "choice") return "선택 답변";
  const kind = question.contracts.chip?.kind;
  if (kind === "duration") return "기간 선택";
  if (kind === "severity") return "강도 선택";
  return "증상 선택";
}

export function InputSwitcher({
  activeMode,
  disabled,
  onChange,
  question,
}: InputSwitcherProps) {
  if (question.allowedModes.length < 2) return null;
  return (
    <div aria-label="입력 방식" className={styles.switcher} role="tablist">
      {question.allowedModes.map((mode) => (
        <button
          aria-selected={activeMode === mode}
          className={styles.tab}
          disabled={disabled}
          key={mode}
          onClick={() => onChange(mode)}
          role="tab"
          type="button"
        >
          {modeLabel(question, mode)}
        </button>
      ))}
    </div>
  );
}
