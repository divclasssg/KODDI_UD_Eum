import { describe, expect, it } from "vitest";

import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { toUtcTimestamp } from "@/lib/db/contracts";
import { OnboardingTimestampMismatchError } from "@/lib/db/errors";
import { createOnboardingRepository } from "@/lib/db/onboarding-repository";

import {
  SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
  SYNTHETIC_PROFILE_BUNDLE_INPUT,
} from "./fixtures";

function readStore<T>(
  database: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

describe("onboarding repository", () => {
  it("동의와 프로필 묶음을 한 transaction으로 저장한다", async () => {
    const database = await openMedicalInterviewDatabase();
    const repository = createOnboardingRepository(database);

    const result = await repository.complete({
      consent: SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
      profileBundle: SYNTHETIC_PROFILE_BUNDLE_INPUT,
    });

    expect(result.profile.displayName).toBe("김테스트");
    expect(await readStore(database, "consents", "current")).toMatchObject({
      localStorage: { state: "granted" },
      sensitiveHealth: { state: "granted" },
    });
    expect(await readStore(database, "profiles", "default")).toMatchObject({
      birthDate: "1958-05-20",
    });
    expect(
      await readStore(database, "medicalProfiles", "default"),
    ).toMatchObject({
      familyHistory: { state: "unknown" },
      smoking: { state: "no" },
    });

    database.close();
  });

  it("마지막 store 쓰기가 실패하면 앞선 쓰기도 남기지 않는다", async () => {
    const database = await openMedicalInterviewDatabase();
    const repository = createOnboardingRepository(database, {
      beforePut: (storeName) => {
        if (storeName === "medicalProfiles") throw new Error("합성 실패");
      },
    });

    await expect(
      repository.complete({
        consent: SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
        profileBundle: SYNTHETIC_PROFILE_BUNDLE_INPUT,
      }),
    ).rejects.toThrow("합성 실패");
    expect(await readStore(database, "consents", "current")).toBeUndefined();
    expect(await readStore(database, "profiles", "default")).toBeUndefined();

    database.close();
  });

  it("세 record의 완료 timestamp가 다르면 아무것도 저장하지 않는다", async () => {
    const database = await openMedicalInterviewDatabase();
    const repository = createOnboardingRepository(database);

    await expect(
      repository.complete({
        consent: SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
        profileBundle: {
          ...SYNTHETIC_PROFILE_BUNDLE_INPUT,
          profile: {
            ...SYNTHETIC_PROFILE_BUNDLE_INPUT.profile,
            updatedAt: toUtcTimestamp("2026-07-22T01:00:01.000Z"),
          },
        },
      }),
    ).rejects.toBeInstanceOf(OnboardingTimestampMismatchError);
    expect(await readStore(database, "consents", "current")).toBeUndefined();
    expect(await readStore(database, "profiles", "default")).toBeUndefined();

    database.close();
  });
});
