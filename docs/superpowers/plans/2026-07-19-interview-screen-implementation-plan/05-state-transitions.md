> [상위 계획](../2026-07-19-interview-screen-implementation-plan.md)

### Task 5: 비동기·오류·안전 전환

**Files:**
- Create: `src/features/interview/components/async-status.tsx`
- Create: `src/features/interview/components/error-notice.tsx`
- Create: `src/features/interview/components/safety-notice.tsx`
- Create: `src/features/interview/use-interview-controller.ts`
- Create: `src/features/interview/fixture-interview-commands.ts`
- Create: `src/features/interview/interview-route-screen.tsx`
- Create: `src/app/interview/new/page.tsx`
- Create: `src/app/interview/new/page.module.scss`
- Modify: `.env.example`
- Modify: `src/features/interview/interview-screen.tsx`
- Test: `tests/unit/interview/interview-transitions.test.tsx`

**Interfaces:**
- Consumes: `INTERVIEW_FIXTURES`, `resolveFixtureId`, `InterviewScreen`
- Produces: `createFixtureInterviewCommands(id)`, `InterviewRouteScreen`, `/interview/new?fixture=<id>`

- [x] **Step 1: fake timer 전환 테스트를 작성한다**

```tsx
it("저장 1회 뒤에만 AI를 호출한다", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const commands = createFixtureInterviewCommands("answering-default");
  render(<InterviewScreen initialModel={INTERVIEW_FIXTURES["answering-default"].model} commands={commands} />);
  await user.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
  await user.click(screen.getByRole("button", { name: "다음" }));
  expect(commands.calls.save).toBe(1);
  expect(commands.calls.ai).toBe(0);
  await vi.advanceTimersByTimeAsync(900);
  expect(commands.calls.ai).toBe(1);
});
```

- [x] **Step 2: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/interview-transitions.test.tsx`

Expected: controller·commands module not found로 FAIL.

- [x] **Step 3: controller와 fixture commands를 구현한다**

controller는 `answering → saving → waiting-for-ai → answering|summary-transition|error`만 소유한다. 저장 status는 300ms 후 표시하고 fixture save는 900ms, AI는 1,200ms 뒤 승인 결과를 반환한다. request ID로 늦은 결과와 중복 submit을 폐기한다.

```ts
export type FixtureCommandCounters = { save: number; ai: number };
export type FixtureInterviewCommands = InterviewCommands & {
  calls: FixtureCommandCounters;
  retrySave(): Promise<void>;
  retryAi(): Promise<void>;
};
```

- [x] **Step 4: 상태 UI를 구현한다**

`AsyncStatus`는 polite status와 `aria-busy`, `ErrorNotice`는 alert와 재시도, `SafetyNotice`는 caution warning 또는 urgent alert를 렌더링한다. urgent에서는 composer를 DOM 탭 순서에서 제거한다. 상태 변경 후 제목 ref로 focus를 이동하고 같은 live 문구는 반복 설정하지 않는다.

- [x] **Step 5: Server page에서 fixture query를 차단한다**

```tsx
import { notFound } from "next/navigation";
import { InterviewRouteScreen } from "@/features/interview/interview-route-screen";

type InterviewPageProps = {
  searchParams: Promise<{ fixture?: string | string[] }>;
};

export default async function Page({ searchParams }: InterviewPageProps) {
  const query = await searchParams;
  const raw = query.fixture;
  const enabled = process.env.INTERVIEW_FIXTURE_MODE === "1";
  const resolved = raw === undefined ? undefined : resolveFixtureId(raw, enabled);
  if (resolved && !resolved.ok) notFound();
  const fixture = resolved?.ok ? INTERVIEW_FIXTURES[resolved.id] : INTERVIEW_FIXTURES["answering-default"];
  return <main><DevicePreview><InterviewRouteScreen key={fixture.id} initialModel={fixture.model} fixtureId={fixture.id} /></DevicePreview></main>;
}
```

Client 경계에서는 서버 env를 다시 읽지 않고 직렬화된 ID로 fixture command를 만든다.

```tsx
"use client";

export function InterviewRouteScreen({ initialModel, fixtureId }: {
  initialModel: InterviewViewModel;
  fixtureId: InterviewFixtureId;
}) {
  const [commands] = useState(() => createFixtureInterviewCommands(fixtureId));
  return <InterviewScreen initialModel={initialModel} commands={commands} />;
}
```

`.env.example`에는 secret이 아닌 `INTERVIEW_FIXTURE_MODE=0`과 테스트 전용 설명을 추가한다.

- [x] **Step 6: 9개 직접 상태와 오류 복구 테스트를 완성한다**

각 fixture의 제목, role, busy, 잠긴 입력, 주요 행동을 registry `expected`와 비교한다. save-error retry는 draft를 유지하고 save만 재호출하며, ai-error retry는 저장하지 않고 AI만 호출하는지 확인한다. urgent 이후 일반 입력이 복구되지 않는지 확인한다.

- [x] **Step 7: 검증 후 멈춘다**

Run: `npm run test:unit -- tests/unit/interview && npm run lint && npm run typecheck && npm run build`

Expected: 모두 PASS. commit·push는 하지 않는다.

검증(2026-07-19): 문진 단위 테스트 31건, 아이콘 계약 6건, 토큰 계약 4건과 `npm run lint`, `npm run typecheck`, `npm run build`가 통과했다. 브라우저 E2E와 200% 확대 검수는 Task 6에서 수행한다.
