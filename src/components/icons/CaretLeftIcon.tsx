import { IconBase } from "./_internal/IconBase";
import type { IconProps } from "./_internal/icon.types";

/**
 * 작은 영역에서 왼쪽 방향을 나타내는 고정 굵기 24px caret입니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.
 */
export function CaretLeftIcon({ className }: IconProps) {
  return (
    <IconBase className={className} height={24} viewBox="0 0 24 24" width={24}>
      <path
        d="M14 16L10 12L14 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </IconBase>
  );
}
