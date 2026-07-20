# Modal MedGemma 외부 데모 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개·익명 합성 페르소나 데모에서 Next.js 서버를 통해 인증된 Modal MedGemma를 호출하고, 검증 실패·비용 상한·provider 장애 때 수동 흐름으로 안전하게 완주한다.

**Architecture:** 브라우저는 versioned DTO만 Node.js Route Handler에 보내며, Route Handler가 Origin·JSON·크기·식별정보를 검사하고 익명 쿠키와 HMAC 식별자를 붙인다. Modal의 단일 동시성 CPU gate가 영속 Dict에서 분당·시간당·일일 한도를 원자적으로 검사한 뒤에만 scale-to-zero GPU 함수로 MedGemma를 호출한다. mock과 actual adapter는 같은 port를 구현하고 출력은 서버에서 다시 schema·안전 검증한다.

**Tech Stack:** Next.js 16.2.10 Route Handlers, React 19.2.4, TypeScript strict, Vitest, Modal Python SDK, FastAPI, PyTorch, Transformers, MedGemma 1.5 4B IT

## 공통 제약

- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 실제 환자·건강정보·식별정보·사진·음성은 입력하거나 전송하지 않는다.
- 브라우저가 Modal URL·proxy token·Hugging Face token을 알 수 없어야 한다.
- 질문 수·단계·진행률을 고정하지 않는다.
- `429`, `503`, 일시적 transport 오류만 1회 재시도한다.
- `401`, `403`, schema·금지 출력 오류는 재시도하지 않는다.
- T4, `min_containers=0`, `max_containers=1`, 60초 scale-down으로 시작한다.
- Modal Workspace 월 예산은 $30 하드 캡으로 설정한다.
- mock 성공, actual 성공, 외부 공개 성공을 서로 대체하지 않는다.
- 사용자 요청 전에는 commit·push하지 않는다.

## 승인 기준

- [Modal 외부 데모 설계](../specs/2026-07-20-modal-medgemma-external-demo-design.md)
- [Modal 런타임·보안·검증](../specs/2026-07-20-modal-medgemma-external-demo-design/01-modal-runtime-security-verification.md)
- [MedGemma 1.5 model card](https://huggingface.co/google/medgemma-1.5-4b-it)
- [Modal Proxy Tokens](https://modal.com/docs/guide/webhook-proxy-auth)
- [Modal Budgets](https://modal.com/docs/guide/budgets)

## Next.js 16.2.10 적용 메모

- 구현 전 `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `02-guides/data-security.md`, `02-guides/environment-variables.md`, `03-api-reference/04-functions/cookies.md`를 다시 읽는다.
- `POST` Route Handler는 Web `Request`/`Response`를 사용하고 cache하지 않는다.
- `cookies()`는 async이므로 Route Handler에서 `await`하며 cookie 변경은 server response에서만 한다.
- credential과 provider factory는 server-only module에만 두고 `NEXT_PUBLIC_` 변수를 만들지 않는다.

## 파일 지도

```text
src/features/interview/interview-commands.ts
src/features/interview/http-interview-commands.ts
src/lib/ai/{contracts,validators,prompt,provider}.ts
src/lib/ai/{mock-medgemma-adapter,modal-medgemma-adapter}.ts
src/lib/demo/{direct-identifier,request-guards,anonymous-session}.ts
src/app/api/ai/{question,summary}/route.ts
inference/modal_medgemma/{medgemma_app,schemas,prompts,quota}.py
tests/unit/{ai,demo,interview}/*
tests/modal/test_*.py
tests/actual/modal-medgemma.actual.test.ts
```

## 작업 순서

1. [ ] [공유 command·DTO·validator 계약](./2026-07-20-modal-medgemma-external-demo-implementation-plan/01-contracts-and-validation.md)
2. [ ] [Next.js provider와 Route Handler](./2026-07-20-modal-medgemma-external-demo-implementation-plan/02-next-provider-and-routes.md)
3. [ ] [Modal quota gate와 MedGemma GPU 함수](./2026-07-20-modal-medgemma-external-demo-implementation-plan/03-modal-runtime.md)
4. [ ] [실제 화면 연결과 fallback](./2026-07-20-modal-medgemma-external-demo-implementation-plan/04-interview-integration.md)
5. [ ] [actual gate·문서·최종 검증](./2026-07-20-modal-medgemma-external-demo-implementation-plan/05-actual-and-docs.md)

## 완료 gate

- mock unit/integration과 일반 E2E는 credential 없이 결정론적으로 통과한다.
- Modal 인증 누락은 GPU를 기동하지 않고 거절된다.
- session 5/min, IP 20/hour, actual 100/day와 단일 active request가 검증된다.
- 직접 식별정보·unknown field·oversize·turn 초과는 Modal 호출 전에 거절된다.
- 3 Persona actual 질문·요약과 cold/warm 성능 증거가 payload 없이 남는다.
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`가 통과한다.

## 실행 메모

각 task는 실패 테스트를 먼저 확인하고 최소 구현 후 좁은 검증을 통과시킨다. 계획에 표시된 commit 지점은 사용자가 commit을 별도로 요청한 경우에만 실행한다.
