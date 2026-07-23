import { useEffect, useState } from "react";

const PROFILE_SAVE_SUCCESS_KEY = "koddi.profile-save-success";

export function markProfileSaveSuccess(): void {
  try {
    sessionStorage.setItem(PROFILE_SAVE_SUCCESS_KEY, "true");
  } catch {
    // 저장소를 사용할 수 없어도 프로필 저장과 이동은 계속한다.
  }
}

export function consumeProfileSaveSuccess(): boolean {
  try {
    const saved = sessionStorage.getItem(PROFILE_SAVE_SUCCESS_KEY) === "true";
    sessionStorage.removeItem(PROFILE_SAVE_SUCCESS_KEY);
    return saved;
  } catch {
    return false;
  }
}

export function useProfileSaveSuccessAnnouncement(): boolean {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active && consumeProfileSaveSuccess()) setSaved(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return saved;
}
