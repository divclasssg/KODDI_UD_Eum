import type {
  ConsentRecordV1,
  GrantConsentInputV1,
} from "./contracts";
import { requestResult, transactionComplete } from "./database";

export type ConsentRepository = {
  getCurrent(): Promise<ConsentRecordV1 | undefined>;
  grant(input: GrantConsentInputV1): Promise<ConsentRecordV1>;
  withdrawLocalStorage(): Promise<void>;
};

export function createConsentRepository(
  database: IDBDatabase,
): ConsentRepository {
  return {
    async getCurrent() {
      const transaction = database.transaction("consents", "readonly");
      return requestResult<ConsentRecordV1 | undefined>(
        transaction.objectStore("consents").get("current"),
      );
    },
    async grant(input) {
      const record: ConsentRecordV1 = {
        id: "current",
        schemaVersion: 1,
        localStorage: { state: "granted", ...input.localStorage },
        sensitiveHealth: {
          state: "granted",
          ...input.sensitiveHealth,
        },
        aiTransfer: input.aiTransfer,
        updatedAt: input.updatedAt,
      };
      const transaction = database.transaction("consents", "readwrite");
      transaction.objectStore("consents").put(record);
      await transactionComplete(transaction);
      return record;
    },
    async withdrawLocalStorage() {
      const transaction = database.transaction("consents", "readwrite");
      transaction.objectStore("consents").delete("current");
      await transactionComplete(transaction);
    },
  };
}
