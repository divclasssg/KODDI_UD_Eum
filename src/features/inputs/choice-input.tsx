import type { OptionInputContractV2 } from "../interview/domain/interview-draft";
import styles from "./input-adapters.module.scss";

type ChoiceInputProps = {
  contract: OptionInputContractV2;
  disabled: boolean;
  onChange: (selectedOptionIds: string[]) => void;
  selectedOptionIds: string[];
};

export function ChoiceInput({
  contract,
  disabled,
  onChange,
  selectedOptionIds,
}: ChoiceInputProps) {
  const inputType = contract.selection === "single" ? "radio" : "checkbox";
  const select = (optionId: string) => {
    if (contract.selection === "single") {
      onChange([optionId]);
      return;
    }
    if (optionId === contract.unknownOptionId) {
      onChange(
        selectedOptionIds.includes(optionId) ? [] : [contract.unknownOptionId],
      );
      return;
    }
    const knownSelections = selectedOptionIds.filter(
      (id) => id !== contract.unknownOptionId,
    );
    const next = knownSelections.includes(optionId)
      ? knownSelections.filter((id) => id !== optionId)
      : [...knownSelections, optionId];
    onChange(next);
  };
  return (
    <fieldset className={styles.options} disabled={disabled}>
      <legend>답변 선택</legend>
      {contract.options.map((option) => (
        <label className={styles.option} key={option.id}>
          <input
            checked={selectedOptionIds.includes(option.id)}
            name="interview-choice"
            onChange={() => select(option.id)}
            type={inputType}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
