import { Logo } from "@/components/brand/Logo";
import {
  ChevronDownIcon,
  ImageAddIcon,
  MicrophoneIcon,
  SearchIcon,
} from "@/components/icons";

const approvedUsage = [
  <ChevronDownIcon key="chevron" weight="bold" />,
  <ImageAddIcon key="image" variant="filled" />,
  <MicrophoneIcon key="microphone" size={32} />,
  <SearchIcon className="search-icon" key="search" />,
  <Logo className="brand-logo" key="logo" />,
];

// @ts-expect-error 임의 색상은 부모 CSS에서 지정해야 합니다.
const invalidColor = <SearchIcon color="red" />;
// @ts-expect-error 마이크는 승인된 두 크기만 지원합니다.
const invalidMicrophoneSize = <MicrophoneIcon size={20} />;
// @ts-expect-error chevron은 임의 크기 속성을 제공하지 않습니다.
const invalidChevronSize = <ChevronDownIcon size={32} />;
// @ts-expect-error 승인되지 않은 선 굵기 이름은 사용할 수 없습니다.
const invalidWeight = <ChevronDownIcon weight="semibold" />;
// @ts-expect-error 이미지 아이콘은 outline과 filled만 지원합니다.
const invalidVariant = <ImageAddIcon variant="solid" />;
// @ts-expect-error 접근 가능한 이름은 로고를 사용하는 요소에 지정합니다.
const invalidLogoLabel = <Logo aria-label="이음" />;

void [
  approvedUsage,
  invalidColor,
  invalidMicrophoneSize,
  invalidChevronSize,
  invalidWeight,
  invalidVariant,
  invalidLogoLabel,
];
