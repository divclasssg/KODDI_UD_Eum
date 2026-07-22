import type {
  CommonDraftV2,
  MeasurementInputContractV2,
} from "../interview/domain/interview-draft";
import styles from "./input-adapters.module.scss";

type MeasurementValue = CommonDraftV2["values"]["measurement"];

type MeasurementInputProps = {
  contract: MeasurementInputContractV2;
  disabled: boolean;
  onChange: (value: MeasurementValue) => void;
  value: MeasurementValue;
};

export function MeasurementInput({
  contract,
  disabled,
  onChange,
  value,
}: MeasurementInputProps) {
  const fieldsDisabled = disabled || value.state === "unknown";
  const update = (next: Partial<MeasurementValue>) =>
    onChange({ ...value, state: "known", ...next });
  return (
    <fieldset className={styles.measurement} disabled={disabled}>
      <legend>측정값 입력</legend>
      <div className={styles.field}>
        <label htmlFor="measurement-value">측정값</label>
        <input
          disabled={fieldsDisabled}
          id="measurement-value"
          inputMode="decimal"
          onChange={(event) => update({ rawValue: event.target.value })}
          type="number"
          value={value.rawValue}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="measurement-unit">단위</label>
        <select
          disabled={fieldsDisabled}
          id="measurement-unit"
          onChange={(event) => update({ unitId: event.target.value })}
          value={value.unitId}
        >
          <option value="">단위를 선택해 주세요</option>
          {contract.units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.label}</option>
          ))}
        </select>
      </div>
      {contract.measuredAt !== "hidden" && (
        <div className={styles.field}>
          <label htmlFor="measurement-time">측정 시각</label>
          <input
            disabled={fieldsDisabled}
            id="measurement-time"
            onChange={(event) => update({ measuredAtLocal: event.target.value })}
            type="datetime-local"
            value={value.measuredAtLocal}
          />
        </div>
      )}
      {contract.allowUnknown && (
        <label className={styles.unknown}>
          <input
            checked={value.state === "unknown"}
            onChange={(event) =>
              onChange({
                ...value,
                state: event.target.checked ? "unknown" : "known",
              })
            }
            type="checkbox"
          />
          <span>잘 모르겠어요</span>
        </label>
      )}
    </fieldset>
  );
}
