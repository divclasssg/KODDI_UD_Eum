# Task 3–4 · 초기 진입과 온보딩 UI

> [상위 계획](../2026-07-22-u2-onboarding-home-integration-plan.md)

## Task 3: database를 만들지 않는 초기 진입

**Files:** `src/lib/db/database-presence.ts`, `src/features/onboarding/root-gate.tsx`, `src/app/page.tsx`, 관련 SCSS와 unit tests

**Produces:** `hasMedicalInterviewDatabase(factory?: IDBFactory): Promise<boolean>`, `RootGate`, `RootGateWithRouter`

- [ ] RED: `databases()` 미지원 시 `open()` 0회와 false, 대상 name 존재 시 true test를 작성한다.
- [ ] Run: `npm run test:unit -- tests/unit/onboarding/database-presence.test.ts`
- [ ] Expected RED: module import 부재로 실패한다.
- [ ] GREEN: `indexedDB.databases()` 결과에서 `koddi-ud-eum` 이름을 찾고 미지원 시 false를 반환한다. 더 높은 version도 존재로 판정해 onboarding overwrite가 아니라 typed open 오류 경로로 보낸다.
- [ ] RED: root gate의 없음→`/onboarding`, 확인 오류→재시도 test를 작성한다.
- [ ] GREEN: effect 취소 flag로 unmount 뒤 navigation을 막고 `router.replace()` wrapper를 둔다.
- [ ] Run: `npm run test:unit -- tests/unit/onboarding/root-gate.test.tsx tests/unit/onboarding/database-presence.test.ts`
- [ ] Expected GREEN: 두 test file이 통과하고 `open()`은 호출되지 않는다.

## Task 4: 실제 제품형 온보딩 UI

**Files:** `src/features/onboarding/onboarding-screen.tsx`, 관련 SCSS, `src/app/onboarding/page.tsx`, `tests/unit/onboarding/onboarding-screen.test.tsx`

**Consumes:** 순수 reducer/validator와 `OnboardingRepository.complete()`

- [ ] RED: local decline repository 0회, 제한된 blocked 행동, back draft 보존, 저장 완료 전 navigation 0회, Persona 문구 부재 test를 작성한다.
- [ ] Run: `npm run test:unit -- tests/unit/onboarding/onboarding-screen.test.tsx`
- [ ] Expected RED: screen module import 부재로 실패한다.
- [ ] GREEN: 목적→로컬 동의→AI 동의→기본정보→의료정보를 한 화면 한 주요 행동으로 렌더링한다.
- [ ] local decline은 `다시 검토하기`, `종료하기`만 제공하며 database를 열지 않는다.
- [ ] AI decline도 프로필 입력을 계속하며 최종 consent state에 `declined`를 쓴다.
- [ ] submit 시작 시 `now().toISOString()`을 한 번만 UTC timestamp로 변환해 세 record에 재사용한다.
- [ ] pending 중 중복 submit/back을 막고 transaction 완료 뒤에만 `/home`으로 이동한다.
- [ ] 실패 시 draft를 유지하며 `role="alert"`와 `다시 저장하기`를 제공한다.
- [ ] 주요 버튼은 최소 48px, 본문/control은 18px, visible focus와 텍스트 오류를 갖는다.
- [ ] 393px에서 가로 스크롤 없이 보이고 단계 번호·progress·Persona/fixture control은 없다.
- [ ] Run: `npm run test:unit -- tests/unit/onboarding/onboarding-screen.test.tsx tests/unit/onboarding/onboarding-machine.test.ts && npm run lint && npm run typecheck`
- [ ] Expected GREEN: 모든 명령이 통과한다.

핵심 navigation test:

```tsx
const completion = Promise.withResolvers<ProfileBundleV1>();
render(<OnboardingScreen complete={() => completion.promise} navigate={navigate} />);
await completeSyntheticForm(user);
expect(navigate).not.toHaveBeenCalled();
completion.resolve(syntheticBundle);
await waitFor(() => expect(navigate).toHaveBeenCalledWith("/home"));
```
