export const DATABASE_NAME = "koddi-ud-eum";
export const DATABASE_VERSION = 1;

export const STORE_NAMES = [
  "attachments",
  "consents",
  "interviewDrafts",
  "interviews",
  "medicalProfiles",
  "messages",
  "profiles",
  "summaries",
] as const;

export type StoreNameV1 = (typeof STORE_NAMES)[number];

export function migrateToV1(database: IDBDatabase): void {
  database.createObjectStore("consents", { keyPath: "id" });
  database.createObjectStore("profiles", { keyPath: "id" });
  database.createObjectStore("medicalProfiles", { keyPath: "id" });

  const interviews = database.createObjectStore("interviews", {
    keyPath: "id",
  });
  interviews.createIndex("byStatus", "status");
  interviews.createIndex("byUpdatedAt", "updatedAt");
  interviews.createIndex("byStatusUpdatedAt", ["status", "updatedAt"]);

  const drafts = database.createObjectStore("interviewDrafts", {
    keyPath: "interviewId",
  });
  drafts.createIndex("byUpdatedAt", "updatedAt");

  const messages = database.createObjectStore("messages", { keyPath: "id" });
  messages.createIndex("byInterviewId", "interviewId");
  messages.createIndex(
    "byInterviewSequence",
    ["interviewId", "sequence"],
    { unique: true },
  );

  const summaries = database.createObjectStore("summaries", {
    keyPath: "interviewId",
  });
  summaries.createIndex("byStatus", "status");
  summaries.createIndex("byUpdatedAt", "updatedAt");

  const attachments = database.createObjectStore("attachments", {
    keyPath: "id",
  });
  attachments.createIndex("byInterviewId", "interviewId");
  attachments.createIndex("byInterviewCreatedAt", ["interviewId", "createdAt"]);
  attachments.createIndex("byKind", "kind");
}
