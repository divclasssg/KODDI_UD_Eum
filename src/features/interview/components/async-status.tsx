import { useEffect, useRef } from "react";

import styles from "../interview-screen.module.scss";

type AsyncStatusProps = {
  description?: string;
  title: string;
};

export function AsyncStatus({ description, title }: AsyncStatusProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={styles.notice}
      role="status"
    >
      <h2 ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
