import {
  normalizeMedicalProfile,
  validateBasicProfile,
} from "@/features/onboarding/onboarding-machine";
import type {
  BasicProfileErrors,
  BasicProfileInput,
  MedicalProfileErrors,
  MedicalProfileInput,
} from "@/features/onboarding/onboarding.types";
import type {
  BirthDateV1,
  KnownTextListV1,
  ProfileBundleV1,
  SaveProfileBundleInputV1,
  UtcTimestamp,
} from "@/lib/db/contracts";

export type ProfileDraft = BasicProfileInput & MedicalProfileInput;

export type ProfileDraftErrors = BasicProfileErrors & MedicalProfileErrors;

export type ProfileDraftValidation =
  | { ok: true; value: SaveProfileBundleInputV1 }
  | { ok: false; errors: ProfileDraftErrors };

function listToText(list: KnownTextListV1): string {
  return list.state === "known" ? list.values.join("\n") : "";
}

export function profileBundleToDraft(bundle: ProfileBundleV1): ProfileDraft {
  const { profile, medicalProfile } = bundle;
  return {
    displayName: profile.displayName,
    birthDate: profile.birthDate,
    sex: profile.sex,
    conditions: listToText(medicalProfile.conditions),
    conditionsUnknown: medicalProfile.conditions.state === "unknown",
    medications: listToText(medicalProfile.medications),
    medicationsUnknown: medicalProfile.medications.state === "unknown",
    allergies: listToText(medicalProfile.allergies),
    allergiesUnknown: medicalProfile.allergies.state === "unknown",
    familyHistory: listToText(medicalProfile.familyHistory),
    familyHistoryUnknown: medicalProfile.familyHistory.state === "unknown",
    medicalHistory: listToText(medicalProfile.medicalHistory),
    medicalHistoryUnknown: medicalProfile.medicalHistory.state === "unknown",
    surgicalHistory: listToText(medicalProfile.surgicalHistory),
    surgicalHistoryUnknown: medicalProfile.surgicalHistory.state === "unknown",
    smokingStatus: medicalProfile.smoking.state,
    smokingDetails:
      medicalProfile.smoking.state === "yes"
        ? medicalProfile.smoking.details ?? ""
        : "",
    alcoholStatus: medicalProfile.alcohol.state,
    alcoholDetails:
      medicalProfile.alcohol.state === "yes"
        ? medicalProfile.alcohol.details ?? ""
        : "",
    heightCm: medicalProfile.heightCm?.toString() ?? "",
    weightKg: medicalProfile.weightKg?.toString() ?? "",
  };
}

export function validateProfileDraft(
  draft: ProfileDraft,
  now: Date,
  updatedAt: UtcTimestamp,
): ProfileDraftValidation {
  const basicErrors = validateBasicProfile(draft, now);
  const medical = normalizeMedicalProfile(draft);
  const errors: ProfileDraftErrors = {
    ...basicErrors,
    ...(medical.ok ? {} : medical.errors),
  };
  if (!medical.ok || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      profile: {
        displayName: draft.displayName.trim(),
        birthDate: draft.birthDate as BirthDateV1,
        sex: draft.sex,
        updatedAt,
      },
      medicalProfile: {
        ...medical.value,
        updatedAt,
      },
    },
  };
}
