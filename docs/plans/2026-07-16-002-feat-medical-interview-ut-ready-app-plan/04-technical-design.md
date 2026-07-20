> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [성공 기준·범위·출처](./03-scope-and-sources.md)
> 다음: [7일 일정과 위험](./05-schedule-and-risks.md)
## Planning Contract

### Priority Order

1. Next.js 설정, SCSS token, 실제 상태를 표현하는 대표 문진 화면
2. Modal MedGemma 실제 smoke와 mock/actual client 경계
3. IndexedDB, 동의, 기본정보, 텍스트·칩 문진
4. 실제 질문·안전 검증·근거 연결 S/O 요약
5. TTS와 음성 입력
6. 홈·기록·오늘 기록·의료진에게 보여주기
7. 이전 기록·내 정보 수정·전체 삭제
8. Figma·Persona 접근성·오류 회귀
9. 사진은 1~8이 일정 안에 통과한 경우에만 구현

### Key Technical Decisions

- KTD1. 앱 구현을 먼저 완료하고 UT 실행 코드는 만들지 않는다. (session-settled: user-directed — chosen over UT-console-first: 실제 검증 대상 앱이 먼저 필요함)
- KTD2. Next.js App Router, TypeScript, ESLint, `src`, `@/*`, React Compiler를 사용한다. React Compiler는 build 실패 시 제외한다.
- KTD3. 애플리케이션 스타일은 Sass/SCSS만 직접 사용한다. SCSS partial과 primitive·semantic·component CSS Custom Properties를 사용하며 BEM 대신 하이픈 class name을 사용한다. 별도 `postcss.config.*`를 만들지 않고 Next.js 기본 `postcss-preset-env`의 Autoprefixer로 브라우저 접두사를 처리한다. `postcss`와 `autoprefixer`를 직접 의존성으로 추가하지 않으며, Next.js가 내부적으로 요구하는 전이 `postcss`만 유지한다. 커스텀 PostCSS 설정이 필요해지는 경우에는 Next.js 기본 플러그인이 대체되므로 필요한 플러그인과 브라우저 대상을 함께 명시적으로 구성한다.
- KTD4. Persona 문서는 런타임에 삽입하지 않는다. 짧은 문장, 한 질문, 큰 조작 영역, 일관된 위치, 낮은 입력 부담을 UI contract와 fixture로 변환한다.
- KTD5. 질문 화면은 `text`, `choice`, `measurement`, `voice`, 조건부 `photo` adapter를 공유한다. 입력 방식 전환은 동일 draft와 answer state를 사용한다.
- KTD6. IndexedDB는 profile, medical profile, interviews, messages, summaries, attachments를 저장한다. 완료 기록은 profile snapshot을 보존한다.
- KTD7. `MedGemmaClient` 아래 mock과 Modal adapter를 둔다. 일반 E2E는 결정론적 mock, 별도 actual gate는 인증된 Modal endpoint를 사용한다.
- KTD8. MedGemma 요청은 stateless다. 앱이 허용된 현재 state, filled slots, 최근 질문·답변을 매번 다시 구성한다.
- KTD9. 강한 위험 신호는 MedGemma 전에 결정론적으로 검사한다. AI가 생성한 진단·치료·복약 안내는 사용자에게 표시하지 않는다.
- KTD10. 질문은 한 문장·한 의도·쉬운 한국어·최대 길이 validator를 통과해야 한다. 실패하면 1회 재시도 후 승인된 수동 질문으로 전환한다.
- KTD11. S/O 각 항목은 answer/message evidence ID를 포함한다. 존재하지 않는 근거와 원문에 없는 수치·날짜·단위는 저장을 거절한다.
- KTD12. AI 비동의·실패 시 versioned manual question set과 deterministic summary로 완주한다. AI 초안과 수동 결과는 명확히 구분한다.
- KTD13. TTS는 명시적 버튼에서만 실행하고 local `ko-KR` voice를 우선한다. 지원 voice가 없으면 text-only를 유지하며 navigation, `visibilitychange`, `pagehide`, reset에서 취소한다.
- KTD14. 외부 데모의 음성 입력은 실제 마이크·녹음·STT 없이 현재 Persona와 질문 slot의 합성 transcript를 채우는 모의 기능이다. 사용자가 확인·수정하고 `다음`을 누른 텍스트만 답변에 반영한다.
- KTD15. 사진 기능은 capture부터 실제 multimodal 응답까지 end-to-end로 검증된 build에서만 feature flag로 노출한다. 저장만 되고 AI가 사용하지 않는 상태는 허용하지 않는다.
- KTD16. 외부 데모는 데스크톱 Chromium의 393×852 고정 프레임과 공개 Next.js 주소를 사용한다. 로그인 없이 합성 Persona만 허용하며 Origin 검증, 익명 session, rate limit, 일일 actual 상한, server kill switch와 Modal 월 hard budget을 적용한다.
- KTD17. Vitest와 React Testing Library로 domain·component·Route Handler를, Playwright로 세 핵심 과업과 Persona fixture를 검증한다.
- KTD18. 의존성 방향은 `UI → application service → pure domain machine → repository/provider ports`로 고정한다. 모든 비동기 명령은 `interviewId`, `revision`, `requestId`를 가지며 현재 revision과 일치할 때만 transaction으로 반영한다.
- KTD19. navigation·reset·동의 철회 시 AI·STT 요청을 abort하고 pending operation을 폐기한다. 늦은 응답, 중복 제출, 삭제 후 재생성을 transaction과 revision guard로 차단한다.
- KTD20. Route Handler는 `AiInterviewContextV1` allowlist DTO만 받으며 unknown field·식별정보·body limit 초과를 거절한다. client와 server가 위험 신호를 각각 검사하고, provider 출력은 server 검증 후 client가 저장 직전 다시 검증한다.
- KTD21. 시스템 지시와 사용자 의료 텍스트를 구조적으로 분리하고 사용자 텍스트는 untrusted data로 취급한다. 모델 출력은 HTML·Markdown으로 해석하지 않고 text로만 렌더링한다.
- KTD22. 요약은 `draft → review → saving → completed` 수명주기를 따르며 completed만 clinician view에 노출한다. 오늘 기록은 `Asia/Seoul`, completed 우선, 같은 날 최신순으로 정렬한다.

### High-Level Technical Design

```mermaid
flowchart TB
  User["Synthetic Persona user"] --> UI["Next.js UI"]
  UI --> Service["Interview application service"]
  Service --> Machine["Pure interview domain machine"]
  Machine --> RepoPort["Repository port"]
  RepoPort --> DB["IndexedDB transaction repositories"]
  Machine --> ProviderPort["Provider port"]
  ProviderPort --> ClientSafety["Client safety + AiInterviewContextV1 builder"]
  ClientSafety --> QuestionAPI["Node.js Question Route Handler"]
  QuestionAPI --> ServerSafety["DTO / identifier / safety validation"]
  ServerSafety --> Client["MedGemmaClient"]
  Client --> Mock["Deterministic mock"]
  Client --> Modal["Authenticated Modal MedGemma endpoint"]
  Modal --> ServerValidators["Server question / evidence validators"]
  ServerValidators --> Service
  Service --> ClientValidators["Client pre-save validators"]
  ClientValidators --> Machine
  ProviderPort --> SummaryAPI["Node.js Summary Route Handler"]
  SummaryAPI --> Modal
  DB --> Records["Records and clinician view"]
  UI --> Speech["Simulated voice input and explicit TTS"]
  Service --> Abort["Abort + revision/request guard"]
```

```mermaid
stateDiagram-v2
  [*] --> Onboarding
  Onboarding --> ConsentBlocked: local storage declined
  ConsentBlocked --> Onboarding: review consent
  ConsentBlocked --> [*]: exit
  Onboarding --> Home: storage consent and profile saved
  Home --> ManualQuestioning: AI declined and manual selected
  Home --> Draft: new interview
  Draft --> SavingAnswer
  SavingAnswer --> SafetyCheck
  SafetyCheck --> SafetyNotice: strong signal
  SafetyNotice --> SafetyAcknowledged: acknowledge
  SafetyAcknowledged --> StopAndSave: stop required
  SafetyAcknowledged --> ManualSummary: manual summary allowed
  SafetyCheck --> GeneratingQuestion: continue
  GeneratingQuestion --> AwaitingAnswer: valid question
  AwaitingAnswer --> SavingAnswer
  GeneratingQuestion --> GeneratingSummary: ready or max questions
  GeneratingQuestion --> ManualQuestioning: unavailable or invalid
  ManualQuestioning --> ManualSummary
  GeneratingSummary --> SummaryReview: evidence valid
  GeneratingSummary --> ManualSummary: failure
  ManualSummary --> SummaryReview
  StopAndSave --> SavingInterview
  SummaryReview --> Draft: edit answers
  SummaryReview --> SavingInterview: confirm
  SavingInterview --> Completed: transaction committed
  SavingInterview --> SummaryReview: save failed
  Completed --> RecordList
  RecordList --> RecordDetail
  RecordDetail --> ClinicianView: completed only
  ClinicianView --> RecordDetail: close or back
  RecordDetail --> ProfileEdit
  ProfileEdit --> SavingProfile
  ProfileEdit --> DiscardConfirm: cancel or leave
  DiscardConfirm --> RecordDetail: discard
  DiscardConfirm --> ProfileEdit: keep editing
  SavingProfile --> ProfileSaved
  SavingProfile --> ProfileEdit: save failed with draft
  ProfileSaved --> RecordDetail: acknowledge
```

### Output Structure

```text
src/
  app/
    api/ai/question/route.ts
    api/ai/summary/route.ts
    onboarding/page.tsx
    home/page.tsx
    interview/new/page.tsx
    records/page.tsx
    records/[id]/page.tsx
    records/[id]/clinician/page.tsx
    profile/page.tsx
  features/
    onboarding/
    interview/
    inputs/
    summary/
    records/
    profile/
    speech/
  lib/
    ai/
    db/
    privacy/
    safety/
  styles/
tests/
  unit/
  integration/
  e2e/
```

### Environment and Runtime Contract

```text
MEDGEMMA_MODE=mock|modal
MEDGEMMA_MODEL_ID=google/medgemma-1.5-4b-it
MEDGEMMA_TIMEOUT_MS=60000
MEDGEMMA_MAX_REQUEST_BYTES=8192
MODAL_MEDGEMMA_ENDPOINT_URL=
MODAL_PROXY_TOKEN_ID=
MODAL_PROXY_TOKEN_SECRET=
DEMO_ALLOWED_ORIGIN=
DEMO_HMAC_SECRET=
MEDGEMMA_ACTUAL_DISABLED=1
NEXT_PUBLIC_ENABLE_PHOTO_INPUT=false
```

- Modal proxy token과 Hugging Face token은 server secret으로만 관리하고 저장소에 두지 않는다.
- 환경 변수와 credential은 client bundle, browser log, IndexedDB에 저장하지 않는다.
- package scripts는 개발·production server를 `127.0.0.1`에 bind한다.
- AI Route Handler는 Node.js runtime에서 실행한다. model version, endpoint, request·response schema, payload limit을 deployment profile로 동결한다.
- 합성 Persona fixture 외 데이터를 입력하지 않는다. Route Handler는 request/response body를 로그에 남기지 않고 응답을 서버에 저장하지 않는다.
- credential 없는 기본 `test:e2e`는 deterministic mock으로 실행한다. opt-in `test:actual`은 credential이 있는 환경에서 serial로 실행하고 provider/model/latency/validator 결과만 별도 증거로 남긴다.
- mock과 actual 실행 결과를 분리하고 actual 실패를 mock 성공으로 대체하지 않는다.

현재 `.env.example`의 Vertex 변수는 Modal 구현 Task 2에서 위 목표 계약으로 교체한다. 문서 승인만으로 provider가 구현됐다고 간주하지 않는다.
