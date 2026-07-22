import type { KnownTextListV1 } from "@/lib/db/contracts";

export type OnboardingStep =
  | "splash"
  | "input-intro"
  | "clinician-intro"
  | "eligibility"
  | "age-blocked"
  | "local-consent"
  | "sensitive-consent"
  | "ai-consent"
  | "basic-profile"
  | "profile-review"
  | "medical-menu"
  | "medical-category"
  | "completion"
  | "consent-blocked"
  | "exit";

export type SexV1 = "female" | "male" | "other" | "unknown";

export type OnboardingDraft = {
  aiTransfer: "granted" | "declined" | undefined;
  displayName: string;
  birthDate: string;
  sex: SexV1;
  conditions: string;
  conditionsUnknown: boolean;
  medications: string;
  medicationsUnknown: boolean;
  allergies: string;
  allergiesUnknown: boolean;
  familyHistory: string;
  familyHistoryUnknown: boolean;
  medicalHistory: string;
  medicalHistoryUnknown: boolean;
  surgicalHistory: string;
  surgicalHistoryUnknown: boolean;
  smokingStatus: "yes" | "no" | "unknown";
  smokingDetails: string;
  alcoholStatus: "yes" | "no" | "unknown";
  alcoholDetails: string;
  heightCm: string;
  weightKg: string;
};

export type OnboardingState = {
  step: OnboardingStep;
  draft: OnboardingDraft;
  activeMedicalCategory?: MedicalCategory;
  blockedConsent?: "local" | "sensitive";
};

export type MedicalCategory =
  | "measurements"
  | "allergies"
  | "medications"
  | "family-history"
  | "history"
  | "lifestyle";

export type BasicProfileInput = Pick<
  OnboardingDraft,
  "displayName" | "birthDate" | "sex"
>;

export type BasicProfileErrors = Partial<
  Record<keyof BasicProfileInput, string>
>;

export type MedicalProfileInput = Pick<
  OnboardingDraft,
  | "conditions"
  | "conditionsUnknown"
  | "medications"
  | "medicationsUnknown"
  | "allergies"
  | "allergiesUnknown"
  | "familyHistory"
  | "familyHistoryUnknown"
  | "medicalHistory"
  | "medicalHistoryUnknown"
  | "surgicalHistory"
  | "surgicalHistoryUnknown"
  | "smokingStatus"
  | "smokingDetails"
  | "alcoholStatus"
  | "alcoholDetails"
  | "heightCm"
  | "weightKg"
>;

export type NormalizedMedicalProfile = {
  conditions: KnownTextListV1;
  medications: KnownTextListV1;
  allergies: KnownTextListV1;
  familyHistory: KnownTextListV1;
  medicalHistory: KnownTextListV1;
  surgicalHistory: KnownTextListV1;
  smoking: import("@/lib/db/contracts").LifestyleAnswerV1;
  alcohol: import("@/lib/db/contracts").LifestyleAnswerV1;
  heightCm?: number;
  weightKg?: number;
};

export type MedicalProfileErrors = Partial<
  Record<"heightCm" | "weightKg", string>
>;

export type MedicalProfileValidation =
  | { ok: true; value: NormalizedMedicalProfile }
  | { ok: false; errors: MedicalProfileErrors };

export type OnboardingAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "confirm-eligibility" }
  | { type: "reject-eligibility" }
  | {
      type: "decide-local-storage";
      decision: "granted" | "declined";
    }
  | {
      type: "decide-ai-transfer";
      decision: "granted" | "declined";
    }
  | {
      type: "decide-sensitive-health";
      decision: "granted" | "declined";
    }
  | { type: "select-medical-category"; category: MedicalCategory }
  | { type: "finish-medical-category" }
  | { type: "finish-medical-profile" }
  | { type: "update-draft"; value: Partial<OnboardingDraft> }
  | { type: "review-consent" }
  | { type: "exit" };
