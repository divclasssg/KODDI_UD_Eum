export type DirectIdentifierKind =
  | "phone"
  | "email"
  | "resident-id"
  | "named-place";

const RESIDENT_ID_PATTERN = /\b\d{6}\s*-\s*[1-4]\d{6}\b/;
const PHONE_PATTERN = /(?:^|\D)(?:01[016789]|0\d{1,2})[- .]?\d{3,4}[- .]?\d{4}(?:\D|$)/;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ADDRESS_PATTERN = /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치시|특별자치도|도|시)?\s*[가-힣]{1,8}(?:시|군|구)(?:\s+[가-힣0-9-]{1,12}(?:읍|면|동|로|길))?/;
const INSTITUTION_PATTERN = /[가-힣A-Z0-9]{2,}(?:대학교)?(?:병원|의원|약국|보건소|의료원)/i;

export function findDirectIdentifier(
  text: string,
): DirectIdentifierKind | undefined {
  // 이 탐지는 명백한 표지만 줄이는 보조 장치이며 실제 건강정보 판별기가 아니다.
  // 정규식 특성상 오탐과 미탐이 가능하므로 탐지 결과나 원문을 로그에 남기지 않는다.
  if (RESIDENT_ID_PATTERN.test(text)) return "resident-id";
  if (PHONE_PATTERN.test(text)) return "phone";
  if (EMAIL_PATTERN.test(text)) return "email";
  if (ADDRESS_PATTERN.test(text) || INSTITUTION_PATTERN.test(text)) {
    return "named-place";
  }
  return undefined;
}
