/** 모든 공개 아이콘이 공통으로 받는 배치용 속성입니다. */
export type IconProps = {
  readonly className?: string;
  readonly "aria-label"?: never;
};

/** regular와 bold 선 굵기를 지원하는 아이콘 속성입니다. */
export type WeightedIconProps = IconProps &
  Readonly<{ weight?: "regular" | "bold" }>;

/** 이미지 추가 아이콘의 외곽선과 채움 형태를 선택합니다. */
export type ImageAddIconProps = IconProps &
  Readonly<{ variant?: "outline" | "filled" }>;

/** 마이크 아이콘의 승인된 24px와 32px 크기를 선택합니다. */
export type MicrophoneIconProps = IconProps &
  Readonly<{ size?: 24 | 32 }>;
