import {
  DatabaseMigrationError,
  DatabaseOpenError,
  DatabaseUpgradeBlockedError,
  DatabaseVersionTooNewError,
} from "./errors";
import { DATABASE_NAME, DATABASE_VERSION, migrateToV1 } from "./schema";

export type DatabaseMigration = (
  database: IDBDatabase,
  transaction: IDBTransaction,
) => void;

export type OpenDatabaseWithMigrationsOptions = {
  factory?: IDBFactory;
  targetVersion: number;
  migrations: Partial<Record<number, DatabaseMigration>>;
  closeOnVersionChange?: boolean;
};

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

function mapOpenError(error: DOMException | null): Error {
  if (error?.name === "VersionError") {
    return new DatabaseVersionTooNewError({ cause: error });
  }
  return new DatabaseOpenError(error ? { cause: error } : undefined);
}

export function openMedicalInterviewDatabase(
  factory: IDBFactory = indexedDB,
): Promise<IDBDatabase> {
  return openDatabaseWithMigrations({
    factory,
    targetVersion: DATABASE_VERSION,
    migrations: { 1: (database) => migrateToV1(database) },
  });
}

export function openDatabaseWithMigrations({
  factory = indexedDB,
  targetVersion,
  migrations,
  closeOnVersionChange = true,
}: OpenDatabaseWithMigrationsOptions): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, targetVersion);
    let migrationFailure: unknown;
    let settled = false;

    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (!transaction) return;
      if (settled) {
        transaction.abort();
        return;
      }
      try {
        const newVersion = event.newVersion ?? targetVersion;
        for (
          let version = event.oldVersion + 1;
          version <= newVersion;
          version += 1
        ) {
          const migration = migrations[version];
          if (!migration) {
            throw new Error(`누락된 database migration: ${version}`);
          }
          migration(request.result, transaction);
        }
      } catch (error) {
        migrationFailure = error;
        transaction.abort();
      }
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(
        migrationFailure
          ? new DatabaseMigrationError({ cause: migrationFailure })
          : mapOpenError(request.error),
      );
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new DatabaseUpgradeBlockedError());
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      if (closeOnVersionChange) {
        request.result.onversionchange = () => request.result.close();
      }
      settled = true;
      resolve(request.result);
    };
  });
}
