import {
  switchInputMode,
  type CommonDraftV2,
  type QuestionSnapshotV2,
} from "../interview/domain/interview-draft";
import { ChipInput } from "./chip-input";
import { ChoiceInput } from "./choice-input";
import { InputSwitcher } from "./input-switcher";
import { MeasurementInput } from "./measurement-input";
import { TextInput } from "./text-input";

type QuestionInputAdapterProps = {
  disabled: boolean;
  draft: CommonDraftV2;
  onDraftChange: (draft: CommonDraftV2) => void;
  question: QuestionSnapshotV2;
};

export function QuestionInputAdapter({
  disabled,
  draft,
  onDraftChange,
  question,
}: QuestionInputAdapterProps) {
  const updateValues = (values: CommonDraftV2["values"]) =>
    onDraftChange({ ...draft, values });
  return (
    <div>
      <InputSwitcher
        activeMode={draft.activeMode}
        disabled={disabled}
        onChange={(mode) => onDraftChange(switchInputMode(draft, mode))}
        question={question}
      />
      {draft.activeMode === "text" && question.contracts.text && (
        <TextInput
          disabled={disabled}
          onChange={(value) =>
            updateValues({ ...draft.values, text: { value } })
          }
          value={draft.values.text.value}
        />
      )}
      {draft.activeMode === "choice" && question.contracts.choice && (
        <ChoiceInput
          contract={question.contracts.choice}
          disabled={disabled}
          onChange={(selectedOptionIds) =>
            updateValues({
              ...draft.values,
              choice: { selectedOptionIds },
            })
          }
          selectedOptionIds={draft.values.choice.selectedOptionIds}
        />
      )}
      {draft.activeMode === "chip" && question.contracts.chip && (
        <ChipInput
          contract={question.contracts.chip}
          disabled={disabled}
          onChange={(selectedOptionIds) =>
            updateValues({ ...draft.values, chip: { selectedOptionIds } })
          }
          selectedOptionIds={draft.values.chip.selectedOptionIds}
        />
      )}
      {draft.activeMode === "measurement" && question.contracts.measurement && (
        <MeasurementInput
          contract={question.contracts.measurement}
          disabled={disabled}
          onChange={(measurement) =>
            updateValues({ ...draft.values, measurement })
          }
          value={draft.values.measurement}
        />
      )}
    </div>
  );
}
