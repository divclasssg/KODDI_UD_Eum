import type {
  BasicProfileErrors,
  BasicProfileInput,
  MedicalProfileErrors,
  MedicalProfileInput,
  MedicalProfileValidation,
  OnboardingAction,
  OnboardingState,
} from "./onboarding.types";

export const initialOnboardingState: OnboardingState = {
  step: "splash",
  draft: {
    aiTransfer: undefined,
    displayName: "",
    birthDate: "",
    sex: "unknown",
    conditions: "",
    conditionsUnknown: true,
    medications: "",
    medicationsUnknown: true,
    allergies: "",
    allergiesUnknown: true,
    familyHistory: "",
    familyHistoryUnknown: true,
    medicalHistory: "",
    medicalHistoryUnknown: true,
    surgicalHistory: "",
    surgicalHistoryUnknown: true,
    smokingStatus: "unknown",
    smokingDetails: "",
    alcoholStatus: "unknown",
    alcoholDetails: "",
    heightCm: "",
    weightKg: "",
  },
};

const previousStep = {
  "input-intro": "splash",
  "clinician-intro": "input-intro",
  eligibility: "clinician-intro",
  "local-consent": "eligibility",
  "sensitive-consent": "local-consent",
  "ai-consent": "sensitive-consent",
  "basic-profile": "ai-consent",
  "profile-review": "basic-profile",
  "medical-menu": "profile-review",
  "medical-category": "medical-menu",
  completion: "medical-menu",
} as const;

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "next":
      if (state.step === "splash") return { ...state, step: "input-intro" };
      if (state.step === "input-intro") {
        return { ...state, step: "clinician-intro" };
      }
      if (state.step === "clinician-intro") {
        return { ...state, step: "eligibility" };
      }
      if (state.step === "basic-profile") {
        return { ...state, step: "profile-review" };
      }
      if (state.step === "profile-review") {
        return { ...state, step: "medical-menu" };
      }
      return state;
    case "back": {
      if (!(state.step in previousStep)) return state;
      return {
        ...state,
        step: previousStep[state.step as keyof typeof previousStep],
        ...(state.step === "medical-category"
          ? { activeMedicalCategory: undefined }
          : {}),
      };
    }
    case "confirm-eligibility":
      if (state.step !== "eligibility") return state;
      return { ...state, step: "local-consent" };
    case "reject-eligibility":
      if (state.step !== "eligibility" && state.step !== "basic-profile") {
        return state;
      }
      return { ...state, step: "age-blocked" };
    case "decide-local-storage":
      if (state.step !== "local-consent") return state;
      return {
        ...state,
        step: action.decision === "granted" ? "sensitive-consent" : "consent-blocked",
        blockedConsent:
          action.decision === "declined" ? "local" : undefined,
      };
    case "decide-sensitive-health":
      if (state.step !== "sensitive-consent") return state;
      return {
        ...state,
        step: action.decision === "granted" ? "ai-consent" : "consent-blocked",
        blockedConsent:
          action.decision === "declined" ? "sensitive" : undefined,
      };
    case "decide-ai-transfer":
      if (state.step !== "ai-consent") return state;
      return {
        step: "basic-profile",
        draft: { ...state.draft, aiTransfer: action.decision },
      };
    case "update-draft":
      return { ...state, draft: { ...state.draft, ...action.value } };
    case "select-medical-category":
      if (state.step !== "medical-menu") return state;
      return {
        ...state,
        step: "medical-category",
        activeMedicalCategory: action.category,
      };
    case "finish-medical-category":
      if (state.step !== "medical-category") return state;
      return { ...state, step: "medical-menu", activeMedicalCategory: undefined };
    case "finish-medical-profile":
      if (state.step !== "medical-menu") return state;
      return { ...state, step: "completion" };
    case "review-consent":
      if (state.step !== "consent-blocked") return state;
      return {
        ...state,
        step:
          state.blockedConsent === "sensitive"
            ? "sensitive-consent"
            : "local-consent",
      };
    case "exit":
      if (state.step !== "consent-blocked" && state.step !== "age-blocked") {
        return state;
      }
      return { ...state, step: "exit" };
  }
}

type EligibilityValidation =
  | { eligible: true }
  | { eligible: false; reason: "invalid" | "under-14" | "over-130" };

function getSeoulDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}

export function validateEligibility(
  birthDate: string,
  now: Date,
): EligibilityValidation {
  const birth = parseDateOnly(birthDate);
  if (!birth) return { eligible: false, reason: "invalid" };
  const today = getSeoulDate(now);
  const beforeBirthday =
    today.month < birth.month ||
    (today.month === birth.month && today.day < birth.day);
  const age = today.year - birth.year - (beforeBirthday ? 1 : 0);
  if (age < 0) return { eligible: false, reason: "invalid" };
  if (age < 14) return { eligible: false, reason: "under-14" };
  if (age > 130) return { eligible: false, reason: "over-130" };
  return { eligible: true };
}

export function validateBasicProfile(
  input: BasicProfileInput,
  now: Date,
): BasicProfileErrors {
  const errors: BasicProfileErrors = {};
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 40) {
    errors.displayName = "이름은 1자부터 40자까지 입력해 주세요.";
  }
  const eligibility = validateEligibility(input.birthDate, now);
  if (!eligibility.eligible) {
    errors.birthDate =
      eligibility.reason === "under-14"
        ? "만 14세 이상만 사용할 수 있어요."
        : "올바른 생년월일을 입력해 주세요.";
  }
  return errors;
}

function normalizeKnownList(value: string, unknown: boolean) {
  if (unknown) return { state: "unknown" } as const;
  return {
    state: "known" as const,
    values: [...new Set(value.split("\n").map((item) => item.trim()).filter(Boolean))],
  };
}

function parseOptionalMeasurement(
  value: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value.trim() === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    return Number.NaN;
  }
  return number;
}

function normalizeLifestyle(
  state: "yes" | "no" | "unknown",
  details: string,
) {
  const normalizedDetails = details.trim();
  if (state !== "yes" || normalizedDetails === "") return { state } as const;
  return { state, details: normalizedDetails } as const;
}

export function normalizeMedicalProfile(
  input: MedicalProfileInput,
): MedicalProfileValidation {
  const heightCm = parseOptionalMeasurement(input.heightCm, 30, 250);
  const weightKg = parseOptionalMeasurement(input.weightKg, 1, 500);
  const errors: MedicalProfileErrors = {};
  if (Number.isNaN(heightCm)) {
    errors.heightCm = "키는 30부터 250cm 사이로 입력해 주세요.";
  }
  if (Number.isNaN(weightKg)) {
    errors.weightKg = "몸무게는 1부터 500kg 사이로 입력해 주세요.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      conditions: normalizeKnownList(
        input.conditions,
        input.conditionsUnknown,
      ),
      medications: normalizeKnownList(
        input.medications,
        input.medicationsUnknown,
      ),
      allergies: normalizeKnownList(input.allergies, input.allergiesUnknown),
      familyHistory: normalizeKnownList(
        input.familyHistory,
        input.familyHistoryUnknown,
      ),
      medicalHistory: normalizeKnownList(
        input.medicalHistory,
        input.medicalHistoryUnknown,
      ),
      surgicalHistory: normalizeKnownList(
        input.surgicalHistory,
        input.surgicalHistoryUnknown,
      ),
      smoking: normalizeLifestyle(input.smokingStatus, input.smokingDetails),
      alcohol: normalizeLifestyle(input.alcoholStatus, input.alcoholDetails),
      ...(heightCm === undefined ? {} : { heightCm }),
      ...(weightKg === undefined ? {} : { weightKg }),
    },
  };
}
