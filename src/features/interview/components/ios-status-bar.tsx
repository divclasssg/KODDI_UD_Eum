import styles from "./device-shell.module.scss";

export function IosStatusBar() {
  return (
    <div aria-hidden="true" className={styles["status-bar"]}>
      <span className={styles.time}>9:41</span>
      <div className={styles["system-indicators"]}>
        <span className={styles.cellular}>
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className={styles.wifi} />
        <span className={styles.battery}>
          <span />
        </span>
      </div>
    </div>
  );
}
