import { requestResult, transactionComplete } from "./database";
import { STORE_NAMES, type StoreNameV1 } from "./schema";

export type LocalDataRepository = {
  resetAll(): Promise<void>;
  countAll(): Promise<Record<StoreNameV1, number>>;
};

type LocalDataRepositoryOptions = {
  beforeClearStore?: (storeName: StoreNameV1) => void;
};

export function createLocalDataRepository(
  database: IDBDatabase,
  options: LocalDataRepositoryOptions = {},
): LocalDataRepository {
  return {
    async resetAll() {
      const transaction = database.transaction(STORE_NAMES, "readwrite");
      const completion = transactionComplete(transaction);
      try {
        for (const storeName of STORE_NAMES) {
          options.beforeClearStore?.(storeName);
          transaction.objectStore(storeName).clear();
        }
      } catch (error) {
        transaction.abort();
        await completion.catch(() => undefined);
        throw error;
      }
      await completion;
    },
    async countAll() {
      const transaction = database.transaction(STORE_NAMES, "readonly");
      const completion = transactionComplete(transaction);
      const counts = await Promise.all(
        STORE_NAMES.map((storeName) =>
          requestResult(transaction.objectStore(storeName).count()),
        ),
      );
      await completion;
      return Object.fromEntries(
        STORE_NAMES.map((storeName, index) => [storeName, counts[index]]),
      ) as Record<StoreNameV1, number>;
    },
  };
}
