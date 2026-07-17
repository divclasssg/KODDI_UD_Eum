import { IconBase } from "./_internal/IconBase";
import type { WeightedIconProps } from "./_internal/icon.types";

/**
 * 삼각형 상태 표시를 위한 24px 아이콘입니다. weight로 선 굵기를 선택합니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.
 */
export function TriangleIcon({
  className,
  weight = "regular",
}: WeightedIconProps) {
  return (
    <IconBase className={className} height={24} viewBox="0 0 24 24" width={24}>
      <path
        d="M4.37891 15.1999C3.46947 16.775 3.01489 17.5634 3.08281 18.2097C3.14206 18.7734 3.43792 19.2851 3.89648 19.6182C4.42204 20.0001 5.3309 20.0001 7.14853 20.0001H16.8515C18.6691 20.0001 19.5778 20.0001 20.1034 19.6182C20.5619 19.2851 20.8579 18.7734 20.9172 18.2097C20.9851 17.5634 20.5307 16.775 19.6212 15.1999L14.7715 6.79986C13.8621 5.22468 13.4071 4.43722 12.8135 4.17291C12.2957 3.94236 11.704 3.94236 11.1862 4.17291C10.5928 4.43711 10.1381 5.22458 9.22946 6.79845L4.37891 15.1999Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={weight === "bold" ? 2 : 1.4}
      />
    </IconBase>
  );
}
