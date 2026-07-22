import type {
  CompleteOnboardingInputV1,
  ConsentRecordV1,
  ProfileBundleV1,
} from "./contracts";
import { transactionComplete } from "./database";
import { OnboardingTimestampMismatchError } from "./errors";

export type OnboardingRepository = {
  complete(input: CompleteOnboardingInputV1): Promise<ProfileBundleV1>;
};

type OnboardingStoreName = "consents" | "profiles" | "medicalProfiles";

type OnboardingRepositoryOptions = {
  beforePut?: (storeName: OnboardingStoreName) => void;
};

export function createOnboardingRepository(
  database: IDBDatabase,
  options: OnboardingRepositoryOptions = {},
): OnboardingRepository {
  return {
    async complete(input) {
      const canonicalTimestamp = input.consent.updatedAt;
      const timestamps = [
        input.consent.localStorage.decidedAt,
        input.consent.sensitiveHealth.decidedAt,
        input.consent.aiTransfer.decidedAt,
        input.profileBundle.profile.updatedAt,
        input.profileBundle.medicalProfile.updatedAt,
      ];
      if (timestamps.some((timestamp) => timestamp !== canonicalTimestamp)) {
        throw new OnboardingTimestampMismatchError();
      }
      const transaction = database.transaction(
        ["consents", "profiles", "medicalProfiles"],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      const consent: ConsentRecordV1 = {
        id: "current",
        schemaVersion: 1,
        localStorage: { state: "granted", ...input.consent.localStorage },
        sensitiveHealth: {
          state: "granted",
          ...input.consent.sensitiveHealth,
        },
        aiTransfer: input.consent.aiTransfer,
        updatedAt: input.consent.updatedAt,
      };
      const bundle: ProfileBundleV1 = {
        profile: {
          id: "default",
          schemaVersion: 1,
          ...input.profileBundle.profile,
        },
        medicalProfile: {
          id: "default",
          schemaVersion: 1,
          ...input.profileBundle.medicalProfile,
        },
      };

      try {
        options.beforePut?.("consents");
        transaction.objectStore("consents").put(consent);
        options.beforePut?.("profiles");
        transaction.objectStore("profiles").put(bundle.profile);
        options.beforePut?.("medicalProfiles");
        transaction.objectStore("medicalProfiles").put(bundle.medicalProfile);
      } catch (error) {
        transaction.abort();
        await completion.catch(() => undefined);
        throw error;
      }

      await completion;
      return bundle;
    },
  };
}
