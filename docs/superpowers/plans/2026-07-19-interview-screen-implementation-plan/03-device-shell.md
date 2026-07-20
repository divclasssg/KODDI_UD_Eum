> [상위 계획](../2026-07-19-interview-screen-implementation-plan.md)

### Task 3: 고정 디바이스 프레임과 상단 셸

**Files:**
- Create: `public/device-frames/iphone-17-black-portrait.png`
- Create: `src/features/interview/components/device-preview.tsx`
- Create: `src/features/interview/components/ios-status-bar.tsx`
- Create: `src/features/interview/components/interview-header.tsx`
- Create: `src/features/interview/components/device-shell.module.scss`
- Create: `tests/unit/interview/device-shell.test.tsx`

**Interfaces:**
- Consumes: `ChevronLeftIcon`, static PNG 1350×2760
- Produces: `DevicePreview({ children })`, `IosStatusBar()`, `InterviewHeader()`

- [x] **Step 1: 실패하는 셸 접근성 테스트를 작성한다**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DevicePreview } from "@/features/interview/components/device-preview";

describe("고정 디바이스 셸", () => {
  it("프레임과 상태바를 장식으로 숨기고 홈 이름을 제공한다", () => {
    const { container } = render(<DevicePreview><p>문진</p></DevicePreview>);
    expect(container.querySelector('img[alt=""]')).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "홈으로 나가기" })).toBeVisible();
  });
});
```

- [x] **Step 2: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/device-shell.test.tsx`

Expected: module not found로 FAIL.

- [x] **Step 3: 승인 PNG를 복사하고 hash를 확인한다**

Run:

```bash
mkdir -p public/device-frames
cp '/Users/seikpark/Desktop/frames/iphone17/iPhone 17/iPhone 17 - Black - Portrait.png' public/device-frames/iphone-17-black-portrait.png
shasum -a 256 public/device-frames/iphone-17-black-portrait.png
```

Expected: `d764eef3dea74910c02ad1c0cef2da6150964c422e1ccc16bb63f75cb8a03dde`.

- [x] **Step 4: DevicePreview를 구현한다**

```tsx
import Image from "next/image";
import { InterviewHeader } from "./interview-header";
import { IosStatusBar } from "./ios-status-bar";
import styles from "./device-shell.module.scss";

export function DevicePreview({ children }: { children: React.ReactNode }) {
  return <div className={styles.device}>
    <div className={styles.viewport}><IosStatusBar /><InterviewHeader />{children}</div>
    <Image className={styles.frame} src="/device-frames/iphone-17-black-portrait.png" alt="" aria-hidden width={1350} height={2760} priority />
  </div>;
}
```

`InterviewHeader`는 48×48 링크 안에 `ChevronLeftIcon`과 시각 텍스트 `홈`을 두고 접근 가능한 이름은 `홈으로 나가기`로 고정한다. `IosStatusBar`는 `9:41`과 CSS로 그린 통신·Wi-Fi·배터리를 하나의 `aria-hidden` 컨테이너에 둔다.

- [x] **Step 5: 고정 치수 SCSS를 구현한다**

`.device` 약 440×900, `.viewport` 393×852, 상태바 48px, 헤더 62px, 프레임 absolute overlay와 `pointer-events:none`, 개구부 radius·inset을 작성한다. 색상·간격은 기존 token만 사용하고 media query를 추가하지 않는다.

- [x] **Step 6: 테스트와 정적 검증을 실행한다**

Run: `npm run test:unit -- tests/unit/interview/device-shell.test.tsx && npm run lint && npm run typecheck`

Expected: 모두 PASS. commit·push는 하지 않는다.
