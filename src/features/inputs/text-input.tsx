import styles from "./input-adapters.module.scss";

type TextInputProps = {
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
};

export function TextInput({ disabled, onChange, value }: TextInputProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="interview-text-draft">답변</label>
      <textarea
        disabled={disabled}
        id="interview-text-draft"
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        value={value}
      />
    </div>
  );
}
