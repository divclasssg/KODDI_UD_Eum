import styles from "../interview-screen.module.scss";

type RoleplayConfirmationProps = {
  checked: boolean;
  onChange(checked: boolean): void;
};

export function RoleplayConfirmation({
  checked,
  onChange,
}: RoleplayConfirmationProps) {
  return (
    <div className={styles["roleplay-confirmation"]}>
      <p>
        가상 인물의 입장에서만 답하고 실제 개인정보·건강정보를 입력하지 마세요.
      </p>
      <label>
        <input
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>가상 인물로 체험하며 실제 정보를 입력하지 않겠습니다</span>
      </label>
    </div>
  );
}
