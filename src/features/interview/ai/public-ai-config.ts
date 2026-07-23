const DEFAULT_MAXIMUM_FOLLOW_UPS = 3;

export function parsePublicAiMaximumFollowUps(value: string | undefined): number {
  const normalized = value?.trim();
  if (!normalized || !/^[1-3]$/.test(normalized)) {
    return DEFAULT_MAXIMUM_FOLLOW_UPS;
  }
  return Number(normalized);
}
