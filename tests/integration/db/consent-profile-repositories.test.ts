import { describe, expect, it, vi } from "vitest";

import { toUtcTimestamp } from "@/lib/db/contracts";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { ConsentRequiredError, InvalidUtcTimestampError } from "@/lib/db/errors";
import { createConsentRepository } from "@/lib/db/consent-repository";
import { createProfileRepository } from "@/lib/db/profile-repository";
import {
  isAiTransferAllowed,
  shouldOpenLocalDatabase,
} from "@/lib/privacy/consent";

import {
  SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
  SYNTHETIC_PROFILE_BUNDLE_INPUT,
} from "./fixtures";

function countStore(database: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).count();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

describe("UTC timestamp 계약", () => {
  it("UTC ISO 8601 millisecond 형식을 허용한다", () => {
    expect(toUtcTimestamp("2026-07-22T01:23:45.678Z")).toBe(
      "2026-07-22T01:23:45.678Z",
    );
  });

  it.each([
    "2026-07-22T10:23:45.678+09:00",
    "2026-07-22T01:23:45Z",
    "2026. 7. 22. 오전 10:23:45",
    "1784683425678",
    "2026-02-30T01:23:45.678Z",
  ])("%s 형식을 거절한다", (value) => {
    expect(() => toUtcTimestamp(value)).toThrow(InvalidUtcTimestampError);
  });
});

describe("동의와 profile repository", () => {
  it("local consent 없이 profile bundle을 쓰지 않는다", async () => {
    const database = await openMedicalInterviewDatabase();
    const repository = createProfileRepository(database);

    await expect(
      repository.saveBundle(SYNTHETIC_PROFILE_BUNDLE_INPUT),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(await countStore(database, "profiles")).toBe(0);
    expect(await countStore(database, "medicalProfiles")).toBe(0);

    database.close();
  });

  it("AI 거부를 저장해도 manual profile local write를 허용한다", async () => {
    const database = await openMedicalInterviewDatabase();
    const consentRepository = createConsentRepository(database);
    const profileRepository = createProfileRepository(database);

    const consent = await consentRepository.grant(
      SYNTHETIC_DECLINED_AI_CONSENT_INPUT,
    );
    const bundle = await profileRepository.saveBundle(
      SYNTHETIC_PROFILE_BUNDLE_INPUT,
    );

    expect(consent.localStorage.state).toBe("granted");
    expect(consent.sensitiveHealth.state).toBe("granted");
    expect(consent.aiTransfer.state).toBe("declined");
    expect(bundle.profile.displayName).toBe("김테스트");
    expect(bundle.profile.birthDate).toBe("1958-05-20");
    expect(bundle.medicalProfile.medications).toEqual({ state: "unknown" });
    expect(bundle.medicalProfile.familyHistory).toEqual({ state: "unknown" });
    expect(await profileRepository.getBundle()).toEqual(bundle);

    database.close();
  });

  it("local 철회는 consent만 지우고 기존 profile을 암묵적으로 지우지 않는다", async () => {
    const database = await openMedicalInterviewDatabase();
    const consentRepository = createConsentRepository(database);
    const profileRepository = createProfileRepository(database);
    await consentRepository.grant(SYNTHETIC_DECLINED_AI_CONSENT_INPUT);
    await profileRepository.saveBundle(SYNTHETIC_PROFILE_BUNDLE_INPUT);

    await consentRepository.withdrawLocalStorage();

    expect(await consentRepository.getCurrent()).toBeUndefined();
    await expect(profileRepository.getBundle()).rejects.toBeInstanceOf(
      ConsentRequiredError,
    );
    expect(await countStore(database, "profiles")).toBe(1);
    expect(await countStore(database, "medicalProfiles")).toBe(1);

    database.close();
  });
});

describe("동의 호출 경계", () => {
  it("local 또는 민감정보 거부는 DB를 열지 않고 AI 거부는 provider를 호출하지 않는다", async () => {
    const openDatabase = vi.fn();
    const callProvider = vi.fn();

    for (const decision of [
      {
        localStorage: "declined",
        sensitiveHealth: "granted",
        aiTransfer: "granted",
      },
      {
        localStorage: "granted",
        sensitiveHealth: "declined",
        aiTransfer: "granted",
      },
    ] as const) {
      if (shouldOpenLocalDatabase(decision)) await openDatabase();
    }
    if (
      isAiTransferAllowed({
        localStorage: "granted",
        sensitiveHealth: "granted",
        aiTransfer: "declined",
      })
    ) {
      await callProvider();
    }

    expect(openDatabase).not.toHaveBeenCalled();
    expect(callProvider).not.toHaveBeenCalled();
  });
});
