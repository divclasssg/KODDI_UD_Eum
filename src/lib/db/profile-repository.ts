import type {
  ConsentRecordV1,
  MedicalProfileRecordV1,
  ProfileBundleV1,
  ProfileRecordV1,
  SaveProfileBundleInputV1,
} from "./contracts";
import { requestResult, transactionComplete } from "./database";
import { ConsentRequiredError } from "./errors";

export type ProfileRepository = {
  getBundle(): Promise<ProfileBundleV1 | undefined>;
  saveBundle(input: SaveProfileBundleInputV1): Promise<ProfileBundleV1>;
};

export function createProfileRepository(
  database: IDBDatabase,
): ProfileRepository {
  return {
    async getBundle() {
      const transaction = database.transaction(
        ["consents", "profiles", "medicalProfiles"],
        "readonly",
      );
      const consent = await requestResult<ConsentRecordV1 | undefined>(
        transaction.objectStore("consents").get("current"),
      );
      if (!consent) {
        transaction.abort();
        throw new ConsentRequiredError();
      }
      const profile = await requestResult<ProfileRecordV1 | undefined>(
        transaction.objectStore("profiles").get("default"),
      );
      const medicalProfile = await requestResult<
        MedicalProfileRecordV1 | undefined
      >(transaction.objectStore("medicalProfiles").get("default"));
      if (!profile || !medicalProfile) return undefined;
      return { profile, medicalProfile };
    },
    async saveBundle(input) {
      const transaction = database.transaction(
        ["consents", "profiles", "medicalProfiles"],
        "readwrite",
      );
      const consent = await requestResult<ConsentRecordV1 | undefined>(
        transaction.objectStore("consents").get("current"),
      );
      if (!consent) {
        transaction.abort();
        throw new ConsentRequiredError();
      }
      const bundle: ProfileBundleV1 = {
        profile: { id: "default", schemaVersion: 1, ...input.profile },
        medicalProfile: {
          id: "default",
          schemaVersion: 1,
          ...input.medicalProfile,
        },
      };
      transaction.objectStore("profiles").put(bundle.profile);
      transaction.objectStore("medicalProfiles").put(bundle.medicalProfile);
      await transactionComplete(transaction);
      return bundle;
    },
  };
}
