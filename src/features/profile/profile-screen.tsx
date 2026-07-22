"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { createProfileRepository } from "@/lib/db/profile-repository";
import {
  toUtcTimestamp,
  type ProfileBundleV1,
  type SaveProfileBundleInputV1,
} from "@/lib/db/contracts";

import {
  profileBundleToDraft,
  validateProfileDraft,
  type ProfileDraft,
  type ProfileDraftErrors,
} from "./profile-draft";
import styles from "./profile-screen.module.scss";

type ProfileScreenProps = {
  load: () => Promise<ProfileBundleV1 | undefined>;
  save: (input: SaveProfileBundleInputV1) => Promise<ProfileBundleV1>;
  navigate: (path: string) => void;
  now?: () => Date;
};

type LoadState = "loading" | "ready" | "error";

const LIST_FIELDS = [
  ["conditions", "conditionsUnknown", "현재 질환"],
  ["medications", "medicationsUnknown", "복용 중인 약"],
  ["allergies", "allergiesUnknown", "알레르기"],
  ["familyHistory", "familyHistoryUnknown", "가족력"],
  ["medicalHistory", "medicalHistoryUnknown", "개인 병력"],
  ["surgicalHistory", "surgicalHistoryUnknown", "수술력"],
] as const;

export function ProfileScreen({
  load,
  save,
  navigate,
  now = () => new Date(),
}: ProfileScreenProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [draft, setDraft] = useState<ProfileDraft>();
  const [errors, setErrors] = useState<ProfileDraftErrors>({});
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    load()
      .then((bundle) => {
        if (!active) return;
        if (!bundle) {
          navigate("/onboarding");
          return;
        }
        setDraft(profileBundleToDraft(bundle));
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [attempt, load, navigate]);

  const update = <Key extends keyof ProfileDraft>(
    key: Key,
    value: ProfileDraft[Key],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  };

  const submit = async () => {
    if (!draft || pending) return;
    const validation = validateProfileDraft(
      draft,
      now(),
      toUtcTimestamp(now().toISOString()),
    );
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setPending(true);
    setSaveError(false);
    try {
      const bundle = await save(validation.value);
      setDraft(profileBundleToDraft(bundle));
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setPending(false);
    }
  };

  if (loadState === "loading") {
    return <main className={styles.page}><p role="status">프로필을 불러오고 있어요.</p></main>;
  }
  if (loadState === "error") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p role="alert">프로필을 불러오지 못했어요.</p>
          <button type="button" onClick={() => { setLoadState("loading"); setAttempt((value) => value + 1); }}>다시 불러오기</button>
          <button type="button" onClick={() => navigate("/home")}>홈으로</button>
        </section>
      </main>
    );
  }
  if (!draft) return null;

  return (
    <main className={styles.page}>
      <form className={styles.card} aria-busy={pending} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <p className={styles.eyebrow}>내 정보</p>
        <h1>프로필 수정</h1>
        <p>문진에 사용할 기본정보와 의료정보를 확인해 주세요.</p>

        <Field label="이름" error={errors.displayName}>
          <input id="profile-display-name" maxLength={40} value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} />
        </Field>
        <Field label="생년월일" error={errors.birthDate}>
          <input id="profile-birth-date" type="date" value={draft.birthDate} onChange={(event) => update("birthDate", event.target.value)} />
        </Field>
        <fieldset>
          <legend>성별</legend>
          <div className={styles.options}>
            {(["female", "male", "other", "unknown"] as const).map((value) => (
              <label key={value}>
                <input type="radio" name="profile-sex" checked={draft.sex === value} onChange={() => update("sex", value)} />
                {{ female: "여성", male: "남성", other: "기타", unknown: "답하지 않음" }[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <h2>의료정보</h2>
        {LIST_FIELDS.map(([valueKey, unknownKey, label]) => (
          <div className={styles.field} key={valueKey}>
            <label htmlFor={`profile-${valueKey}`}>{label}</label>
            <textarea id={`profile-${valueKey}`} disabled={draft[unknownKey]} value={draft[valueKey]} onChange={(event) => update(valueKey, event.target.value)} />
            <label className={styles.checkbox}>
              <input type="checkbox" checked={draft[unknownKey]} onChange={(event) => update(unknownKey, event.target.checked)} />
              잘 모르겠어요
            </label>
          </div>
        ))}

        <LifestyleField label="흡연을 하시나요?" name="smoking" state={draft.smokingStatus} details={draft.smokingDetails} onStateChange={(value) => update("smokingStatus", value)} onDetailsChange={(value) => update("smokingDetails", value)} />
        <LifestyleField label="음주를 하시나요?" name="alcohol" state={draft.alcoholStatus} details={draft.alcoholDetails} onStateChange={(value) => update("alcoholStatus", value)} onDetailsChange={(value) => update("alcoholDetails", value)} />

        <div className={styles.measurements}>
          <Field label="키(cm, 선택)" error={errors.heightCm}>
            <input id="profile-height" type="number" value={draft.heightCm} onChange={(event) => update("heightCm", event.target.value)} />
          </Field>
          <Field label="몸무게(kg, 선택)" error={errors.weightKg}>
            <input id="profile-weight" type="number" value={draft.weightKg} onChange={(event) => update("weightKg", event.target.value)} />
          </Field>
        </div>

        {saveError && <p role="alert">저장하지 못했어요. 입력한 내용은 그대로 있어요.</p>}
        {saved && <p role="status">변경사항을 저장했어요.</p>}
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "저장하고 있어요" : saveError ? "다시 저장" : "변경사항 저장"}
        </button>
        <button type="button" disabled={pending} onClick={() => navigate("/home")}>홈으로</button>
      </form>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement<{ id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }> }) {
  const errorId = `${children.props.id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={children.props.id}>{label}</label>
      {children}
      {error && <p id={errorId} role="alert">{error}</p>}
    </div>
  );
}

function LifestyleField({ label, name, state, details, onStateChange, onDetailsChange }: { label: string; name: string; state: "yes" | "no" | "unknown"; details: string; onStateChange: (value: "yes" | "no" | "unknown") => void; onDetailsChange: (value: string) => void }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className={styles.options}>
        {(["yes", "no", "unknown"] as const).map((value) => (
          <label key={value}>
            <input type="radio" name={name} checked={state === value} onChange={() => onStateChange(value)} />
            {{ yes: "예", no: "아니오", unknown: "잘 모르겠어요" }[value]}
          </label>
        ))}
      </div>
      {state === "yes" && <Field label="추가 메모"><input id={`profile-${name}-details`} value={details} onChange={(event) => onDetailsChange(event.target.value)} /></Field>}
    </fieldset>
  );
}

async function loadWithBrowserDatabase() {
  const database = await openMedicalInterviewDatabase();
  try {
    return await createProfileRepository(database).getBundle();
  } finally {
    database.close();
  }
}

async function saveWithBrowserDatabase(input: SaveProfileBundleInputV1) {
  const database = await openMedicalInterviewDatabase();
  try {
    return await createProfileRepository(database).saveBundle(input);
  } finally {
    database.close();
  }
}

export function ProfileScreenWithRouter() {
  const router = useRouter();
  const navigate = useCallback((path: string) => router.push(path), [router]);
  return <ProfileScreen load={loadWithBrowserDatabase} save={saveWithBrowserDatabase} navigate={navigate} />;
}
