import { createConsentRepository } from "@/lib/db/consent-repository";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { hasMedicalInterviewDatabase } from "@/lib/db/database-presence";
import { createProfileRepository } from "@/lib/db/profile-repository";

export type HomeState =
  | { status: "ready"; displayName: string; aiTransfer: "granted" | "declined" }
  | { status: "missing" }
  | { status: "error" };

export async function loadHomeState(): Promise<HomeState> {
  try {
    if (!(await hasMedicalInterviewDatabase())) return { status: "missing" };
    const database = await openMedicalInterviewDatabase();
    try {
      const consent = await createConsentRepository(database).getCurrent();
      if (!consent) return { status: "missing" };
      const bundle = await createProfileRepository(database).getBundle();
      if (!bundle) return { status: "missing" };
      return {
        status: "ready",
        displayName: bundle.profile.displayName,
        aiTransfer: consent.aiTransfer.state,
      };
    } finally {
      database.close();
    }
  } catch {
    return { status: "error" };
  }
}
