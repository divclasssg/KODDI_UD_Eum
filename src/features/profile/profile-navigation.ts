const HOME_PATH = "/home";
const RECORD_DETAIL_PATTERN = /^\/records\/([^/?#\\]+)$/;
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

export function normalizeProfileReturnTo(
  value: string | string[] | undefined,
): string {
  if (typeof value !== "string") return HOME_PATH;
  if (CONTROL_CHARACTER_PATTERN.test(value)) return HOME_PATH;
  const match = RECORD_DETAIL_PATTERN.exec(value);
  if (!match || match[1].length === 0) return HOME_PATH;
  try {
    const decodedId = decodeURIComponent(match[1]);
    if (
      decodedId.length === 0 ||
      CONTROL_CHARACTER_PATTERN.test(decodedId) ||
      decodedId.includes("\\")
    ) {
      return HOME_PATH;
    }
  } catch {
    return HOME_PATH;
  }
  return value;
}

export function buildProfileEditHref(interviewId: string): string {
  const recordPath = `/records/${encodeURIComponent(interviewId)}`;
  return `/profile?returnTo=${encodeURIComponent(recordPath)}`;
}
