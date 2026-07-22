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

type ProfileRepositoryOptions = {
  beforePutRecord?: (storeName: "profiles" | "medicalProfiles") => void;
};

export function createProfileRepository(
  database: IDBDatabase,
  options: ProfileRepositoryOptions = {},
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
      const completion = transactionComplete(transaction);
      try {
        options.beforePutRecord?.("profiles");
        transaction.objectStore("profiles").put(bundle.profile);
        options.beforePutRecord?.("medicalProfiles");
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
