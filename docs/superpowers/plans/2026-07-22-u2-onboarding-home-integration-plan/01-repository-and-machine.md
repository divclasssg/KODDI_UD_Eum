# Task 1–2 · Repository와 순수 상태 머신

> [상위 계획](../2026-07-22-u2-onboarding-home-integration-plan.md)

## Task 1: 원자적 온보딩 repository

**Files:** `src/lib/db/contracts.ts`, `src/lib/db/onboarding-repository.ts`, `tests/integration/db/onboarding-repository.test.ts`

**Produces:**

```ts
type CompleteOnboardingInputV1 = {
  consent: GrantConsentInputV1;
  profileBundle: SaveProfileBundleInputV1;
};
type OnboardingRepository = {
  complete(input: CompleteOnboardingInputV1): Promise<ProfileBundleV1>;
};
```

- [ ] RED: 세 store 저장과 마지막 store 직전 합성 실패 rollback test를 작성한다.
- [ ] Run: `npm run test:integration -- tests/integration/db/onboarding-repository.test.ts`
- [ ] Expected RED: module import가 존재하지 않아 실패한다.
- [ ] GREEN: `consents`, `profiles`, `medicalProfiles`를 한 `readwrite` transaction으로 열고 `current`, `default`, `default` record를 `put`한다.
- [ ] 동기 실패는 transaction을 abort하고 completion rejection을 소비한 뒤 원래 오류를 다시 throw한다.
- [ ] Run: `npm run test:integration -- tests/integration/db/onboarding-repository.test.ts tests/integration/db/consent-profile-repositories.test.ts`
- [ ] Expected GREEN: 두 test file이 통과하고 rollback 뒤 consent/profile count가 0이다.

핵심 rollback test:

```ts
const repository = createOnboardingRepository(database, {
  beforePut: (storeName) => {
    if (storeName === "medicalProfiles") throw new Error("합성 실패");
  },
});
await expect(repository.complete(input)).rejects.toThrow("합성 실패");
expect(await readStore(database, "consents", "current")).toBeUndefined();
expect(await readStore(database, "profiles", "default")).toBeUndefined();
```

## Task 2: 온보딩 순수 상태 머신과 validation

**Files:** `src/features/onboarding/onboarding.types.ts`, `src/features/onboarding/onboarding-machine.ts`, `tests/unit/onboarding/onboarding-machine.test.ts`

**Produces:** `OnboardingStep`, `OnboardingDraft`, `OnboardingState`, `onboardingReducer()`, `validateBasicProfile()`, `normalizeMedicalProfile()`

- [ ] RED: local decline→blocked, AI decline→basic profile, back draft 보존, 나이 범위, 목록 중복 정리 test를 작성한다.
- [ ] Run: `npm run test:unit -- tests/unit/onboarding/onboarding-machine.test.ts`
- [ ] Expected RED: onboarding model import가 없어 실패한다.
- [ ] GREEN: 다음 단계 union과 draft를 구현한다.

```ts
type OnboardingStep =
  | "purpose"
  | "local-consent"
  | "ai-consent"
  | "basic-profile"
  | "medical-profile"
  | "consent-blocked"
  | "exit";
```

- [ ] reducer는 인접 전이만 허용하며 `back`에서 draft 객체를 보존한다.
- [ ] 이름은 trim 후 1~40자, 나이는 0~130 정수로 검증한다.
- [ ] 의료 목록은 줄바꿈 기준 trim·빈 값 제거·중복 제거 후 known/unknown union으로 만든다.
- [ ] 키는 30~250cm, 몸무게는 1~500kg이며 빈 값은 생략한다.
- [ ] Run: `npm run test:unit -- tests/unit/onboarding/onboarding-machine.test.ts && npm run typecheck`
- [ ] Expected GREEN: test와 typecheck가 통과한다.
