const RECORD_LIST_ANCHOR_PREFIX = "record-";

export function recordListAnchorId(interviewId: string): string {
  return `${RECORD_LIST_ANCHOR_PREFIX}${encodeURIComponent(interviewId)}`;
}

export function recordListHref(interviewId: string): string {
  return `/records#${recordListAnchorId(interviewId)}`;
}

export function recordIdFromListHash(hash: string): string | undefined {
  const prefix = `#${RECORD_LIST_ANCHOR_PREFIX}`;
  if (!hash.startsWith(prefix)) return undefined;
  const encoded = hash.slice(prefix.length);
  if (!encoded) return undefined;
  try {
    const interviewId = decodeURIComponent(encoded);
    return recordListAnchorId(interviewId) === hash.slice(1)
      ? interviewId
      : undefined;
  } catch {
    return undefined;
  }
}
