import { IconBase } from "./_internal/IconBase";
import type { IconProps } from "./_internal/icon.types";

/**
 * 시각적인 시간 또는 기록을 나타내는 24px 시계 아이콘입니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 선택 상태는 부모의 색상 토큰으로 표현하고 접근 가능한 이름도 부모가 제공합니다.
 */
export function ClockIcon({ className }: IconProps) {
  return (
    <IconBase className={className} height={24} viewBox="0 0 24 24" width={24}>
      <path
        d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3ZM12 6.2002C11.5582 6.2002 11.2002 6.55817 11.2002 7V12.5C11.2002 13.0666 11.4667 13.6005 11.9199 13.9404L15.5195 16.6396C15.8728 16.9046 16.3745 16.8335 16.6396 16.4805C16.9046 16.1272 16.8335 15.6255 16.4805 15.3604L12.8799 12.6602C12.8295 12.6224 12.7998 12.563 12.7998 12.5V7C12.7998 6.55817 12.4418 6.2002 12 6.2002Z"
        fill="currentColor"
      />
    </IconBase>
  );
}
