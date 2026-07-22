import { DATABASE_NAME } from "./schema";

export async function hasMedicalInterviewDatabase(
  factory: IDBFactory = indexedDB,
): Promise<boolean> {
  if (typeof factory.databases !== "function") return false;
  const databases = await factory.databases();
  return databases.some(({ name }) => name === DATABASE_NAME);
}
