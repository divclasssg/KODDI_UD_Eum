import { IconBase } from "./_internal/IconBase";
import type { WeightedIconProps } from "./_internal/icon.types";

/**
 * 이전 동작으로 되돌리는 흐름을 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.
 */
export function UndoUpRightIcon({
  className,
  weight = "regular",
}: WeightedIconProps) {
  return (
    <IconBase className={className} height={24} viewBox="0 0 24 24" width={24}>
      <path
        d="M17 5L21 9L17 13M21 9H8C5.23858 9 3 11.2386 3 14C3 16.7614 5.23858 19 8 19H13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={weight === "bold" ? 2 : 1.6}
      />
    </IconBase>
  );
}
