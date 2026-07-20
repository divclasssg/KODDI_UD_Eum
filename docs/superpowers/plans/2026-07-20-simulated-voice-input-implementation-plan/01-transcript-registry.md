> [상위 계획](../2026-07-20-simulated-voice-input-implementation-plan.md)

### Task 1: persona·slot transcript registry

**Files:**
- Create: `src/features/interview/fixtures/persona-voice-fixtures.ts`
- Test: `tests/unit/interview/persona-voice-fixtures.test.ts`

**Interface:**

```ts
import type { DemoPersonaId, InterviewSlotId } from "../model/interview-domain.types";

export function getSimulatedTranscript(
  personaId: DemoPersonaId,
  slot: InterviewSlotId,
): string | undefined;
```

- [ ] **Step 1: registry table test를 작성한다**

각 persona의 9개 slot key가 중복 없이 존재하고 값이 1~80자 plain text이며 실명·전화·이메일·주민등록번호 형식이 없는지 검사한다. 반환 객체를 수정해도 원본 registry가 변하지 않는지 확인한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/persona-voice-fixtures.test.ts`

Expected: module not found로 FAIL.

- [ ] **Step 3: 다음 exact transcript를 registry에 구현한다**

| slot | 김영수 | 이민정 | 박성훈 |
|---|---|---|---|
| chief-complaint | 머리가 아프고 어지러워요. | 배가 아프고 속이 메스꺼워요. | 기침이 나고 목이 아파요. |
| onset | 오늘 아침부터 시작됐어요. | 어제 저녁부터 불편했어요. | 사흘 전부터 시작됐어요. |
| duration | 반나절 정도 됐어요. | 하루 정도 됐어요. | 사흘 정도 됐어요. |
| severity | 일상생활은 할 수 있는 정도예요. | 움직이기 힘들 만큼 아파요. | 참을 수 있지만 계속 신경 쓰여요. |
| pattern | 갑자기 일어나면 더 심해져요. | 밥을 먹은 뒤에 더 아파요. | 밤이 되면 기침이 심해져요. |
| associated-symptoms | 속이 메스껍지만 토하지는 않았어요. | 설사가 있지만 열은 없어요. | 콧물이 나지만 숨이 차지는 않아요. |
| medications | 지금 먹고 있는 약은 없어요. | 평소 먹는 약이 하나 있어요. | 감기약을 한 번 먹었어요. |
| allergies | 알고 있는 알레르기는 없어요. | 특정 약 알레르기는 없어요. | 꽃가루 알레르기가 있어요. |
| safety | 의식은 또렷하고 혼자 걸을 수 있어요. | 쓰러지거나 피를 토한 적은 없어요. | 숨쉬기 어렵거나 가슴이 아프지는 않아요. |

이 문장은 실제 개인의 기록이 아닌 코드 fixture임을 한글 주석으로 남긴다. persona 이름은 UI label일 뿐 provider payload에는 stable ID만 사용한다.

- [ ] **Step 4: 검증 후 멈춘다**

Run: `npm run test:unit -- tests/unit/interview/persona-voice-fixtures.test.ts && npm run typecheck`

Expected: 모두 PASS. commit·push하지 않는다.
