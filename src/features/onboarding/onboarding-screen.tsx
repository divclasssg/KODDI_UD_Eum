"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import type {
  BirthDateV1,
  CompleteOnboardingInputV1,
  ProfileBundleV1,
} from "@/lib/db/contracts";
import { toUtcTimestamp } from "@/lib/db/contracts";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { createOnboardingRepository } from "@/lib/db/onboarding-repository";

import {
  initialOnboardingState,
  normalizeMedicalProfile,
  onboardingReducer,
  validateBasicProfile,
  validateEligibility,
} from "./onboarding-machine";
import type {
  BasicProfileErrors,
  MedicalCategory,
  MedicalProfileErrors,
  OnboardingDraft,
  SexV1,
} from "./onboarding.types";
import styles from "./onboarding-screen.module.scss";

type OnboardingScreenProps = {
  complete: (input: CompleteOnboardingInputV1) => Promise<ProfileBundleV1>;
  navigate: (path: string) => void;
  now?: () => Date;
};

const sexOptions: { value: SexV1; label: string }[] = [
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
  { value: "other", label: "그 외" },
  { value: "unknown", label: "답하지 않음" },
];

const medicalCategories: { value: MedicalCategory; label: string }[] = [
  { value: "measurements", label: "키와 몸무게" },
  { value: "allergies", label: "알레르기" },
  { value: "medications", label: "복용 중인 약" },
  { value: "family-history", label: "가족력" },
  { value: "history", label: "개인 병력과 수술력" },
  { value: "lifestyle", label: "흡연과 음주" },
];

export function OnboardingScreen({
  complete,
  navigate,
  now = () => new Date(),
}: OnboardingScreenProps) {
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState);
  const [eligibilityError, setEligibilityError] = useState<string>();
  const [basicErrors, setBasicErrors] = useState<BasicProfileErrors>({});
  const [medicalErrors, setMedicalErrors] = useState<MedicalProfileErrors>({});
  const [mediaNotice, setMediaNotice] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const updateDraft = (value: Partial<OnboardingDraft>) => {
    dispatch({ type: "update-draft", value });
  };

  const submitEligibility = () => {
    const validation = validateEligibility(state.draft.birthDate, now());
    if (!validation.eligible) {
      if (validation.reason === "under-14") {
        dispatch({ type: "reject-eligibility" });
        return;
      }
      setEligibilityError("올바른 생년월일을 입력해 주세요.");
      document.getElementById("eligibility-birth-date")?.focus();
      return;
    }
    setEligibilityError(undefined);
    dispatch({ type: "confirm-eligibility" });
  };

  const submitBasicProfile = () => {
    const errors = validateBasicProfile(state.draft, now());
    setBasicErrors(errors);
    if (errors.birthDate === "만 14세 이상만 사용할 수 있어요.") {
      dispatch({ type: "reject-eligibility" });
      return;
    }
    if (Object.keys(errors).length > 0) {
      const firstErrorId = errors.displayName ? "display-name" : "birth-date";
      document.getElementById(firstErrorId)?.focus();
      return;
    }
    dispatch({ type: "next" });
  };

  const finishMedicalCategory = () => {
    const normalized = normalizeMedicalProfile(state.draft);
    if (!normalized.ok) {
      setMedicalErrors(normalized.errors);
      const firstErrorId = normalized.errors.heightCm
        ? "height-cm"
        : "weight-kg";
      document.getElementById(firstErrorId)?.focus();
      return;
    }
    setMedicalErrors({});
    dispatch({ type: "finish-medical-category" });
  };

  const submitOnboarding = async () => {
    if (pending || !state.draft.aiTransfer) return;
    const normalized = normalizeMedicalProfile(state.draft);
    if (!normalized.ok) return;

    setSaveError(false);
    setPending(true);
    const timestamp = toUtcTimestamp(now().toISOString());
    try {
      await complete({
        consent: {
          localStorage: {
            noticeVersion: "local-storage-v1",
            decidedAt: timestamp,
          },
          sensitiveHealth: {
            noticeVersion: "sensitive-health-v1",
            decidedAt: timestamp,
          },
          aiTransfer: {
            state: state.draft.aiTransfer,
            noticeVersion: "ai-transfer-v1",
            decidedAt: timestamp,
          },
          updatedAt: timestamp,
        },
        profileBundle: {
          profile: {
            displayName: state.draft.displayName.trim(),
            birthDate: state.draft.birthDate as BirthDateV1,
            sex: state.draft.sex,
            updatedAt: timestamp,
          },
          medicalProfile: {
            ...normalized.value,
            updatedAt: timestamp,
          },
        },
      });
      if (mounted.current) navigate("/home");
    } catch {
      if (mounted.current) {
        setPending(false);
        setSaveError(true);
      }
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={pending}>
        {state.step === "splash" && (
          <>
            <p className={styles.brand}>이음</p>
            <h1>병원 문진, 더 쉽고 편하게.</h1>
            <p>진료에 필요한 의료정보를 미리 준비해 보세요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "next" })}>
              시작하기
            </PrimaryButton>
          </>
        )}

        {state.step === "input-intro" && (
          <>
            <IntroPosition current={1} />
            <h1>아픈 곳을 편하게 알려주세요</h1>
            <p>글, 음성, 사진 중 가장 편한 방법으로 알려주시면 보기 쉽게 정리해 드려요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "next" })}>다음</PrimaryButton>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "clinician-intro" && (
          <>
            <IntroPosition current={2} />
            <h1>의료진에게 보여주세요</h1>
            <p>미리 정리한 문진을 활용하면 진료실에서 내 상태를 더 정확하게 설명할 수 있어요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "next" })}>계속</PrimaryButton>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "eligibility" && (
          <>
            <h1>이용 가능 여부를 확인할게요</h1>
            <p>이음은 만 14세 이상부터 사용할 수 있어요.</p>
            <Field label="생년월일" error={eligibilityError}>
              <input
                id="eligibility-birth-date"
                type="date"
                value={state.draft.birthDate}
                onChange={(event) => updateDraft({ birthDate: event.target.value })}
              />
            </Field>
            <PrimaryButton onClick={submitEligibility}>확인하고 계속</PrimaryButton>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "age-blocked" && (
          <>
            <h1>만 14세 이상만 이용할 수 있어요</h1>
            <p>입력한 정보는 저장되지 않았어요.</p>
            <button className={styles.secondary} type="button" onClick={() => dispatch({ type: "exit" })}>
              종료하기
            </button>
          </>
        )}

        {state.step === "local-consent" && (
          <>
            <h1>이 기기에 정보를 저장해도 될까요?</h1>
            <p>이름과 작성 내용은 지금 사용하는 브라우저 안에 저장되며 언제든 모두 지울 수 있어요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "decide-local-storage", decision: "granted" })}>
              동의하고 계속
            </PrimaryButton>
            <button className={styles.secondary} type="button" onClick={() => dispatch({ type: "decide-local-storage", decision: "declined" })}>
              저장하지 않기
            </button>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "sensitive-consent" && (
          <>
            <h1>건강정보를 이 기기에서 처리해도 될까요?</h1>
            <p>질환, 복용약, 알레르기 같은 민감한 건강정보를 문진 작성과 복원에 사용해요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "decide-sensitive-health", decision: "granted" })}>
              민감정보 처리에 동의하고 계속
            </PrimaryButton>
            <button className={styles.secondary} type="button" onClick={() => dispatch({ type: "decide-sensitive-health", decision: "declined" })}>
              민감정보 저장하지 않기
            </button>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "ai-consent" && (
          <>
            <h1>AI 도움을 받을까요?</h1>
            <p>동의하면 문진에 필요한 최소 정보만 AI 처리 경로로 보내요. 동의하지 않아도 수동 문진을 사용할 수 있어요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "decide-ai-transfer", decision: "granted" })}>
              AI 전송에 동의하고 계속
            </PrimaryButton>
            <button className={styles.secondary} type="button" onClick={() => dispatch({ type: "decide-ai-transfer", decision: "declined" })}>
              AI 전송 없이 계속
            </button>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "consent-blocked" && (
          <>
            <h1>필수 동의가 필요해요</h1>
            <p>문진을 저장하고 다시 확인하려면 로컬 저장과 건강정보 처리 동의가 필요해요. 아직 어떤 정보도 저장하지 않았어요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "review-consent" })}>
              다시 검토하기
            </PrimaryButton>
            <button className={styles.secondary} type="button" onClick={() => dispatch({ type: "exit" })}>
              종료하기
            </button>
          </>
        )}

        {state.step === "exit" && (
          <>
            <h1>안전하게 종료했어요</h1>
            <p>이 브라우저에는 입력한 정보가 저장되지 않았어요.</p>
          </>
        )}

        {state.step === "basic-profile" && (
          <>
            <h1>정확한 상담을 위해 기본정보를 입력해주세요</h1>
            <div className={styles.fields}>
              <Field label="이름" error={basicErrors.displayName}>
                <input id="display-name" value={state.draft.displayName} maxLength={40} onChange={(event) => updateDraft({ displayName: event.target.value })} />
              </Field>
              <Field label="생년월일" error={basicErrors.birthDate}>
                <input id="birth-date" type="date" value={state.draft.birthDate} onChange={(event) => updateDraft({ birthDate: event.target.value })} />
              </Field>
              <fieldset>
                <legend>성별</legend>
                <div className={styles.options}>
                  {sexOptions.map((option) => (
                    <label key={option.value}>
                      <input type="radio" name="sex" value={option.value} checked={state.draft.sex === option.value} onChange={() => updateDraft({ sex: option.value })} />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <PrimaryButton onClick={submitBasicProfile}>기본정보 확인</PrimaryButton>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "profile-review" && (
          <>
            <p className={styles.eyebrow}>프로필</p>
            <h1>{state.draft.displayName}님의 기본정보를 확인해 주세요</h1>
            <dl className={styles.summary}>
              <div><dt>생년월일</dt><dd>{state.draft.birthDate}</dd></div>
              <div><dt>성별</dt><dd>{sexOptions.find(({ value }) => value === state.draft.sex)?.label}</dd></div>
            </dl>
            <p>문진 중 확인한 의료정보는 이 기기에 저장되며 언제든 수정하거나 삭제할 수 있어요.</p>
            <PrimaryButton onClick={() => dispatch({ type: "next" })}>의료정보 준비하기</PrimaryButton>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "medical-menu" && (
          <>
            <h1>어떤 의료정보를 추가할까요?</h1>
            <p>알고 있는 항목만 선택해도 괜찮아요.</p>
            <div className={styles.categoryGrid}>
              {medicalCategories.map((category) => (
                <button key={category.value} className={styles.category} type="button" onClick={() => dispatch({ type: "select-medical-category", category: category.value })}>
                  {category.label}
                </button>
              ))}
            </div>
            <PrimaryButton onClick={() => dispatch({ type: "finish-medical-profile" })}>
              입력을 마치고 확인
            </PrimaryButton>
            <BackButton onClick={() => dispatch({ type: "back" })} />
          </>
        )}

        {state.step === "medical-category" && state.activeMedicalCategory && (
          <MedicalCategoryForm
            category={state.activeMedicalCategory}
            draft={state.draft}
            errors={medicalErrors}
            updateDraft={updateDraft}
            showMediaNotice={() => setMediaNotice(true)}
            finish={finishMedicalCategory}
            back={() => dispatch({ type: "back" })}
          />
        )}

        {state.step === "completion" && (
          <>
            <p className={styles.eyebrow}>입력 완료</p>
            <h1>의료정보 준비를 마쳤어요</h1>
            <p>저장한 정보는 프로필과 문진에서 다시 확인할 수 있어요.</p>
            {saveError && <p role="alert">저장하지 못했어요. 입력한 내용은 그대로 있어요.</p>}
            {pending && <p role="status">안전하게 저장하고 있어요.</p>}
            <button className={styles.primary} type="button" disabled={pending} onClick={submitOnboarding}>
              {saveError ? "다시 저장하기" : "저장하고 홈으로"}
            </button>
            <BackButton disabled={pending} onClick={() => dispatch({ type: "back" })} />
          </>
        )}
      </section>

      {mediaNotice && (
        <div className={styles.dialogBackdrop}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="media-notice-title">
            <h2 id="media-notice-title">현재 데모에서는 준비 중인 기능입니다</h2>
            <p>마이크나 사진 권한을 요청하지 않았어요. 텍스트와 선택 입력으로 계속할 수 있어요.</p>
            <PrimaryButton onClick={() => setMediaNotice(false)}>텍스트로 계속</PrimaryButton>
          </div>
        </div>
      )}
    </main>
  );
}

function MedicalCategoryForm({ category, draft, errors, updateDraft, showMediaNotice, finish, back }: {
  category: MedicalCategory;
  draft: OnboardingDraft;
  errors: MedicalProfileErrors;
  updateDraft: (value: Partial<OnboardingDraft>) => void;
  showMediaNotice: () => void;
  finish: () => void;
  back: () => void;
}) {
  return (
    <>
      <h1>{medicalCategories.find(({ value }) => value === category)?.label}</h1>
      {category === "measurements" && (
        <div className={styles.fields}>
          <Field label="키(cm, 선택)" error={errors.heightCm}>
            <input id="height-cm" type="number" value={draft.heightCm} onChange={(event) => updateDraft({ heightCm: event.target.value })} />
          </Field>
          <Field label="몸무게(kg, 선택)" error={errors.weightKg}>
            <input id="weight-kg" type="number" value={draft.weightKg} onChange={(event) => updateDraft({ weightKg: event.target.value })} />
          </Field>
        </div>
      )}
      {category === "allergies" && (
        <MedicalListField id="allergies" label="알레르기(약물, 음식)" unknownLabel="알레르기를 잘 모르겠어요" value={draft.allergies} unknown={draft.allergiesUnknown} onChange={(value) => updateDraft({ allergies: value })} onUnknownChange={(value) => updateDraft({ allergiesUnknown: value })} />
      )}
      {category === "medications" && (
        <MedicalListField id="medications" label="복용 중인 약" unknownLabel="복용약을 잘 모르겠어요" value={draft.medications} unknown={draft.medicationsUnknown} onChange={(value) => updateDraft({ medications: value })} onUnknownChange={(value) => updateDraft({ medicationsUnknown: value })} />
      )}
      {category === "family-history" && (
        <MedicalListField id="family-history" label="가족력" unknownLabel="가족력을 잘 모르겠어요" value={draft.familyHistory} unknown={draft.familyHistoryUnknown} onChange={(value) => updateDraft({ familyHistory: value })} onUnknownChange={(value) => updateDraft({ familyHistoryUnknown: value })} />
      )}
      {category === "history" && (
        <div className={styles.fields}>
          <MedicalListField id="medical-history" label="개인 병력" unknownLabel="개인 병력을 잘 모르겠어요" value={draft.medicalHistory} unknown={draft.medicalHistoryUnknown} onChange={(value) => updateDraft({ medicalHistory: value })} onUnknownChange={(value) => updateDraft({ medicalHistoryUnknown: value })} />
          <MedicalListField id="surgical-history" label="수술력" unknownLabel="수술력을 잘 모르겠어요" value={draft.surgicalHistory} unknown={draft.surgicalHistoryUnknown} onChange={(value) => updateDraft({ surgicalHistory: value })} onUnknownChange={(value) => updateDraft({ surgicalHistoryUnknown: value })} />
        </div>
      )}
      {category === "lifestyle" && (
        <div className={styles.fields}>
          <LifestyleField legend="흡연을 하시나요?" name="smoking" state={draft.smokingStatus} details={draft.smokingDetails} onStateChange={(value) => updateDraft({ smokingStatus: value })} onDetailsChange={(value) => updateDraft({ smokingDetails: value })} />
          <LifestyleField legend="음주를 하시나요?" name="alcohol" state={draft.alcoholStatus} details={draft.alcoholDetails} onStateChange={(value) => updateDraft({ alcoholStatus: value })} onDetailsChange={(value) => updateDraft({ alcoholDetails: value })} />
        </div>
      )}
      <div className={styles.mediaActions}>
        <button className={styles.secondary} type="button" aria-label="음성 입력, 준비 중" onClick={showMediaNotice}>음성 입력</button>
        {category === "medications" && (
          <button className={styles.secondary} type="button" aria-label="사진 추가, 준비 중" onClick={showMediaNotice}>사진 추가</button>
        )}
      </div>
      <PrimaryButton onClick={finish}>이 정보 저장</PrimaryButton>
      <BackButton onClick={back} />
    </>
  );
}

function LifestyleField({ legend, name, state, details, onStateChange, onDetailsChange }: {
  legend: string;
  name: string;
  state: "yes" | "no" | "unknown";
  details: string;
  onStateChange: (value: "yes" | "no" | "unknown") => void;
  onDetailsChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className={styles.options}>
        {(["yes", "no", "unknown"] as const).map((value) => (
          <label key={value}>
            <input type="radio" name={name} checked={state === value} onChange={() => onStateChange(value)} />
            {{ yes: "예", no: "아니오", unknown: "잘 모르겠어요" }[value]}
          </label>
        ))}
      </div>
      {state === "yes" && (
        <Field label="추가 메모">
          <textarea id={`${name}-details`} value={details} onChange={(event) => onDetailsChange(event.target.value)} />
        </Field>
      )}
    </fieldset>
  );
}

function IntroPosition({ current }: { current: 1 | 2 }) {
  return <p className={styles.introPosition} aria-label={`서비스 소개 ${current}`}>{current === 1 ? "● ○" : "○ ●"}</p>;
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button className={styles.primary} type="button" onClick={onClick}>{children}</button>;
}

function BackButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button className={styles.back} type="button" disabled={disabled} onClick={onClick}>이전</button>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement<{ id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }> }) {
  const id = children.props.id;
  const errorId = `${id}-error`;
  const control = cloneElement(children, {
    "aria-describedby": error ? errorId : undefined,
    "aria-invalid": error ? true : undefined,
  });
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {control}
      {error && <p id={errorId} role="alert">{error}</p>}
    </div>
  );
}

function MedicalListField({ id, label, unknownLabel, value, unknown, onChange, onUnknownChange }: {
  id: string;
  label: string;
  unknownLabel: string;
  value: string;
  unknown: boolean;
  onChange: (value: string) => void;
  onUnknownChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} value={value} disabled={unknown} placeholder="한 줄에 하나씩 입력해 주세요" onChange={(event) => onChange(event.target.value)} />
      <label className={styles.checkbox}>
        <input type="checkbox" checked={unknown} onChange={(event) => onUnknownChange(event.target.checked)} />
        {unknownLabel}
      </label>
    </div>
  );
}

async function completeWithBrowserDatabase(input: CompleteOnboardingInputV1): Promise<ProfileBundleV1> {
  const database = await openMedicalInterviewDatabase();
  try {
    return await createOnboardingRepository(database).complete(input);
  } finally {
    database.close();
  }
}

export function OnboardingScreenWithRouter() {
  const router = useRouter();
  const navigate = useCallback((path: string) => router.replace(path), [router]);
  return <OnboardingScreen complete={completeWithBrowserDatabase} navigate={navigate} />;
}
