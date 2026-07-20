import { MicrophoneIcon } from "@/components/icons/MicrophoneIcon";

import type { InterviewDraft } from "../model/interview-ui.types";
import styles from "../interview-screen.module.scss";

type TextInputProps = {
  disabled: boolean;
  draft: InterviewDraft;
  onTextChange: (text: string) => void;
  onVoiceSelect: () => void;
};

export function TextInput({
  disabled,
  draft,
  onTextChange,
  onVoiceSelect,
}: TextInputProps) {
  return (
    <div className={styles["text-input"]}>
      <label className={styles["visually-hidden"]} htmlFor="interview-text-answer">
        직접 입력
      </label>
      <textarea
        disabled={disabled}
        id="interview-text-answer"
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="직접 입력해도 괜찮아요"
        rows={1}
        value={draft.text}
      />
      <button
        aria-label="음성으로 답하기"
        aria-pressed={draft.inputMode === "voice"}
        disabled={disabled}
        onClick={onVoiceSelect}
        type="button"
      >
        <MicrophoneIcon />
      </button>
    </div>
  );
}
