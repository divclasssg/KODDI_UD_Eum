import type { IconProps } from "@/components/icons/_internal/icon.types";

type LogoProps = IconProps & Readonly<{ "aria-label"?: never }>;

/**
 * 48×32 크기의 브랜드 로고입니다.
 *
 * 고유 색상을 유지하는 장식용 SVG입니다.
 * 링크나 헤더에서 사용할 때 접근 가능한 이름은 사용하는 요소에 지정합니다.
 */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={32}
      viewBox="0 0 48 32"
      width={48}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M32 16C32 24.8366 24.8366 32 16 32C7.16344 32 0 24.8366 0 16C0 7.16344 7.16344 0 16 0C24.8366 0 32 7.16344 32 16Z"
        fill="#16A9B1"
      />
      <path
        d="M16 16C16 7.16344 23.1634 0 32 0C40.8366 0 48 7.16344 48 16V32H32C23.1634 32 16 24.8366 16 16Z"
        fill="#545FD6"
        fillOpacity={0.3}
      />
    </svg>
  );
}
