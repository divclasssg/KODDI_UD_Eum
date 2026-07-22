# Task 5–6 · 홈, E2E, 문서와 검증

> [상위 계획](../2026-07-22-u2-onboarding-home-integration-plan.md)

## Task 5: 저장 상태를 복원하는 홈

**Files:** `src/features/home/load-home-state.ts`, `src/features/home/home-screen.tsx`, 관련 SCSS, `src/app/home/page.tsx`, `tests/unit/home/home-screen.test.tsx`

**Produces:** `HomeState`, `loadHomeState()`, `HomeScreen`, `HomeScreenWithRouter`

- [ ] RED: AI decline 수동 기본 행동, AI grant 두 방식 구분, 누락→onboarding, 오류→재시도 test를 작성한다.
- [ ] Run: `npm run test:unit -- tests/unit/home/home-screen.test.tsx`
- [ ] Expected RED: home module import 부재로 실패한다.
- [ ] GREEN: database 존재 확인 뒤 consent와 profile bundle을 읽고 database를 반드시 닫는다.
- [ ] missing이면 `/onboarding`, error면 `다시 불러오기`, ready면 이름과 AI consent를 표시한다.
- [ ] AI decline은 `외부 AI로 정보를 보내지 않아요`와 수동 경로만 표시한다.
- [ ] 문진 실행 전까지 행동은 `aria-disabled="true"`와 `준비 중`을 함께 표시한다.
- [ ] Run: `npm run test:unit -- tests/unit/home/home-screen.test.tsx && npm run lint && npm run typecheck`
- [ ] Expected GREEN: 모두 통과한다.

## Task 6: 실제 브라우저 흐름과 문서

**Files:** `tests/e2e/onboarding-home.spec.ts`, 구현 체크리스트 3개, `docs/worklogs/2026-07-22.md`, `docs/README.md`

- [ ] 합성 사용자 `테스트 사용자`, 나이 `67`, unknown 의료정보로 onboarding→home E2E를 작성한다.
- [ ] reload 뒤 같은 홈 heading이 복원되는지 검증한다.
- [ ] local decline 뒤 `indexedDB.databases()`에 대상 database가 없는지 검증한다.
- [ ] AI decline 흐름의 `/api/ai/` request 수가 0인지 검증한다.
- [ ] body에 Persona/fixture 문구가 없는지 검증한다.
- [ ] Run: `npm run build && npx playwright test tests/e2e/onboarding-home.spec.ts --project=chromium`
- [ ] Expected: build와 Chromium E2E 2건이 통과한다.
- [ ] 체크리스트에는 증거가 있는 UI와 E2E만 완료 표시한다.
- [ ] manual 실행, profile edit, reset UI는 미완료로 남기고 U2 전체 진행률은 올리지 않는다.
- [ ] 작업일지에 actual-like 공개 흐름, 합성 test 입력, Persona 주입 후순위를 기록한다.

## Final Verification

```bash
git diff --check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npx playwright test --project=chromium
```

모든 명령이 exit 0이어야 한다. 기존 multiple-lockfile Next.js warning은 비실패로 기록한다. `test:actual`, Modal 배포, GPU 호출은 실행하지 않는다.
