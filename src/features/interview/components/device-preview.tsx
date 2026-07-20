import Image from "next/image";
import type { ReactNode } from "react";

import { InterviewHeader } from "./interview-header";
import { IosStatusBar } from "./ios-status-bar";
import styles from "./device-shell.module.scss";

type DevicePreviewProps = {
  children: ReactNode;
};

export function DevicePreview({ children }: DevicePreviewProps) {
  return (
    <div className={styles.device} data-testid="device-preview">
      <div className={styles.viewport} data-testid="app-viewport">
        <IosStatusBar />
        <InterviewHeader />
        <div className={styles.content}>{children}</div>
      </div>
      <Image
        aria-hidden="true"
        alt=""
        className={styles.frame}
        height={2760}
        loading="eager"
        src="/device-frames/iphone-17-black-portrait.png"
        width={1350}
      />
    </div>
  );
}
