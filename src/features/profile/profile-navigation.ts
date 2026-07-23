const HOME_PATH = "/home";
const RECORD_DETAIL_PATTERN = /^\/records\/([^/?#\\]+)$/;

export function normalizeProfileReturnTo(
  value: string | string[] | undefined,
): string {
  if (typeof value !== "string") return HOME_PATH;
  const match = RECORD_DETAIL_PATTERN.exec(value);
  if (!match || match[1].length === 0) return HOME_PATH;
  try {
    if (decodeURIComponent(match[1]).length === 0) return HOME_PATH;
  } catch {
    return HOME_PATH;
  }
  return value;
}

export function buildProfileEditHref(interviewId: string): string {
  const recordPath = `/records/${encodeURIComponent(interviewId)}`;
  return `/profile?returnTo=${encodeURIComponent(recordPath)}`;
}
