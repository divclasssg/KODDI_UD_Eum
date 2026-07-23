> [상위 계획](../2026-07-20-modal-medgemma-external-demo-implementation-plan.md)

### Task 2: Next.js provider와 Route Handler

**Files:**
- Create: `src/lib/ai/provider.ts`
- Create: `src/lib/ai/prompt.ts`
- Create: `src/lib/ai/mock-medgemma-adapter.ts`
- Create: `src/lib/ai/modal-medgemma-adapter.ts`
- Create: `src/lib/demo/anonymous-session.ts`
- Create: `src/lib/demo/request-guards.ts`
- Create: `src/app/api/ai/question/route.ts`
- Create: `src/app/api/ai/summary/route.ts`
- Test: `tests/unit/ai/modal-medgemma-adapter.test.ts`
- Test: `tests/unit/ai/route-handler.test.ts`
- Modify: `.env.example`

**Provider contract:**

```ts
export interface MedGemmaProvider {
  requestQuestion(context: AiInterviewContextV1, signal: AbortSignal,
                  identity: AiRequestIdentity): Promise<AiQuestionResponseV1>;
  requestSummary(context: AiInterviewContextV1, signal: AbortSignal,
                 identity: AiRequestIdentity): Promise<AiSummaryResponseV1>;
}
```

`AiRequestIdentity`는 Route Handler가 만든 session/IP HMAC만 담는 서버 전용 값이다. 브라우저 DTO에 넣지 않으며 Modal body의 quota 식별자를 provider port까지 전달한다.

- [x] **Step 1: adapter mapping 테스트를 작성한다**

`Modal-Key`/`Modal-Secret`, body allowlist, 비용 우선 기본 75초 abort와 180초 허용 상한, `401/403` no-retry, `429/503` 1회 retry, invalid JSON/schema no-retry, client에 일반화한 오류만 반환하는지 fetch mock으로 검증한다.

- [x] **Step 2: Route Handler guard 테스트를 작성한다**

허용 Origin POST JSON은 200과 HttpOnly cookie를 받고, 잘못된 Origin/content-type/body/식별정보는 provider call 0회로 400/403/413을 받는다. cookie 속성은 `Secure`(production), `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=86400`으로 고정한다.

- [x] **Step 3: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/ai/modal-medgemma-adapter.test.ts tests/unit/ai/route-handler.test.ts`

Expected: module/route not found로 FAIL.

- [x] **Step 4: server-only provider factory와 adapter를 구현한다**

`MEDGEMMA_MODE=mock|modal` 외 값은 시작 시 오류로 처리한다. Modal adapter는 endpoint에 `kind`, context, session/IP HMAC만 보내고 prompt를 Next 로그에 남기지 않는다. 출력 text를 JSON으로 parse한 뒤 Task 1 validator를 통과시킨다.

- [x] **Step 5: 공통 Route Handler를 구현한다**

두 `route.ts`는 얇게 유지하고 `handleAiPost(kind, request)`를 호출한다. `await cookies()`로 익명 UUID를 발급하며, 32 byte 이상인 `DEMO_HMAC_SECRET`으로 session과 proxy IP를 각각 HMAC-SHA256 처리한다. IP는 trusted proxy가 붙인 `x-forwarded-for`의 마지막 주소를 사용하고 로컬에서는 `127.0.0.1`로 제한한다. 호스트 확정 시 proxy가 이 header를 덮어쓰거나 append하는지 배포 gate에서 확인한다. 응답은 `Cache-Control: no-store`이고 raw error·credential을 포함하지 않는다.

- [x] **Step 6: 환경 계약을 바꾼다**

`.env.example`에서 Vertex 변수를 제거하고 다음 이름만 둔다.

```dotenv
MEDGEMMA_MODE=mock
MEDGEMMA_MODEL_ID=google/medgemma-1.5-4b-it
MEDGEMMA_TIMEOUT_MS=75000
MEDGEMMA_MAX_REQUEST_BYTES=8192
MODAL_MEDGEMMA_ENDPOINT_URL=
MODAL_PROXY_TOKEN_ID=
MODAL_PROXY_TOKEN_SECRET=
DEMO_ALLOWED_ORIGIN=http://127.0.0.1:3000
DEMO_HMAC_SECRET=
MEDGEMMA_ACTUAL_DISABLED=1
```

기존 대표 화면의 서버 전용 fixture gate인 `INTERVIEW_FIXTURE_MODE=0`은 AI provider 환경 계약과 독립적이므로 유지한다.

- [x] **Step 7: 좁은 검증 후 멈춘다**

Run: `npm run test:unit -- tests/unit/ai tests/unit/demo && npm run lint && npm run typecheck`

Expected: 모두 PASS. commit·push하지 않는다.
