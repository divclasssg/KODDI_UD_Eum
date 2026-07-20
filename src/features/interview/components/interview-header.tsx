import Link from "next/link";

import { ChevronLeftIcon } from "@/components/icons/ChevronLeftIcon";

import styles from "./device-shell.module.scss";

export function InterviewHeader() {
  return (
    <header className={styles.header}>
      <Link
        aria-label="홈으로 나가기"
        className={styles["home-link"]}
        href="/"
      >
        <ChevronLeftIcon weight="bold" />
        <span>홈</span>
      </Link>
    </header>
  );
}
