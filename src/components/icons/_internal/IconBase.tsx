import type { ReactNode } from "react";

type IconBaseProps = Readonly<{
  children: ReactNode;
  className?: string;
  width: number;
  height: number;
  viewBox: string;
}>;

/** 공개 아이콘의 크기와 장식용 접근성 속성을 고정하는 내부 SVG입니다. */
export function IconBase({
  children,
  className,
  width,
  height,
  viewBox,
}: IconBaseProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={height}
      viewBox={viewBox}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}
