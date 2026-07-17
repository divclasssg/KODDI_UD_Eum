import { IconBase } from "./_internal/IconBase";
import type { WeightedIconProps } from "./_internal/icon.types";

/**
 * 작은 영역에서 아래 방향을 나타내는 24px caret입니다. weight로 선 굵기를 선택합니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.
 */
export function CaretDownIcon({
  className,
  weight = "regular",
}: WeightedIconProps) {
  return (
    <IconBase className={className} height={24} viewBox="0 0 24 24" width={24}>
      <path
        d="M8 10L12 14L16 10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={weight === "bold" ? 2 : 1.4}
      />
    </IconBase>
  );
}
