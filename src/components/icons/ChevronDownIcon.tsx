import { IconBase } from "./_internal/IconBase";
import type { WeightedIconProps } from "./_internal/icon.types";

/**
 * 아래 방향을 나타내는 24px chevron입니다. weight로 선 굵기를 선택합니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.
 */
export function ChevronDownIcon({
  className,
  weight = "regular",
}: WeightedIconProps) {
  return (
    <IconBase className={className} height={24} viewBox="0 0 24 24" width={24}>
      <path
        d="M19 9L12 16L5 9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={weight === "bold" ? 2 : 1.4}
      />
    </IconBase>
  );
}
