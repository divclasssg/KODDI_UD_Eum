import type { ChipInputContractV2 } from "../interview/domain/interview-draft";
import styles from "./input-adapters.module.scss";

type ChipInputProps = {
  contract: ChipInputContractV2;
  disabled: boolean;
  onChange: (selectedOptionIds: string[]) => void;
  selectedOptionIds: string[];
};

export function ChipInput({
  contract,
  disabled,
  onChange,
  selectedOptionIds,
}: ChipInputProps) {
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
      <legend>
        {contract.kind === "duration"
          ? "기간 선택"
          : contract.kind === "severity"
            ? "강도 선택"
            : "증상 선택"}
      </legend>
      <div className={styles.chips}>
        {contract.options.map((option) => (
          <label className={styles.chip} key={option.id}>
            <input
              checked={selectedOptionIds.includes(option.id)}
              name="interview-chip"
              onChange={() => select(option.id)}
              type={inputType}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
