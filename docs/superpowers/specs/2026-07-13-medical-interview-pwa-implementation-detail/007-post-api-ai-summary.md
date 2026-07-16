> [문서 인덱스](../2026-07-13-medical-interview-pwa-implementation-detail.md)
> 이전: [`예 / 아니오 / 모르겠음` 처리](./006-예-아니오-모르겠음-처리.md)
> 다음: [모델 id 규칙](./008-모델-id-규칙.md)


- `action`이 `ask_next`이면 다음 질문을 보여준다.
- `action`이 `show_safety_notice`이면 안전 안내를 먼저 보여준다.
- `action`이 `ready_for_summary`이면 저장 후보 확인 또는 요약 생성으로 넘어간다.
- `safetyNotice.level`이 `urgent`이면 `nextQuestion`이 있어도 먼저 안전 안내를 보여준다.
- 안전 안내는 진단이 아니라 도움 요청 안내다.

실패 응답:

```ts
type ApiErrorResponse = {
  ok: false;
  errorCode:
    | "HF_RATE_LIMIT"
    | "HF_MODEL_LOADING"
    | "HF_UNAVAILABLE"
    | "INVALID_AI_OUTPUT"
    | "NETWORK_ERROR"
    | "AI_CONSENT_REQUIRED"
    | "PHOTO_AI_CONSENT_REQUIRED"
    | "UNKNOWN_ERROR";
  message: string;
  retryable: boolean;
  canUseManualSummary: boolean;
};
```

### `POST /api/ai/summary`

역할:

- 문진 기록을 S/O 요약으로 만든다.
- 진단명이나 치료 추천이 들어가면 서버에서 제거하거나 실패 처리한다.

요청:

```ts
type SummaryApiRequest = {
  interviewId: string;
  profileSnapshot: ProfileSnapshot;
  messages: InterviewMessageForAi[];
  measurements: Measurement[];
  attachments: AttachmentForAi[];
};
```

응답:

```ts
type SummaryApiResponse = {
  ok: true;
  summary: MedicalSummary;
};
```

### `POST /api/ai/manual-summary`

역할:

- AI가 실패했을 때 앱 안에서 입력된 내용을 규칙 기반으로 정리한다.
- MedGemma를 호출하지 않는다.
- 완성도는 낮아도 의료진에게 보여줄 최소 요약을 만든다.
- AI 전송 동의가 없어도 사용할 수 있다.

이름은 API 구조상 `/api/ai/manual-summary`이지만 실제 AI 호출은 없다.  
구현 시 혼동이 크면 `/api/interview/manual-summary`로 옮겨도 된다.

사용하는 경우:

- AI 전송 동의가 없음
- Hugging Face 무료 사용량 초과
- 네트워크 오류
- 모델 로딩 실패
- MedGemma 응답 JSON 파싱 실패
- MedGemma 응답에 진단명 또는 치료 추천이 포함되어 실패 처리됨

요청:

```ts
type ManualSummaryApiRequest = {
  interviewId: string;
  profileSnapshot: ProfileSnapshot;
  messages: InterviewMessage[];
  measurements: Measurement[];
  attachments: AttachmentMeta[];
  safetyNotice?: SafetyNotice;
};
```

응답:

```ts
type ManualSummaryApiResponse = {
  ok: true;
  summary: ManualSummary;
};
```

응답 규칙:

- 사용자가 입력한 원문을 그대로 보여준다.
- 사진과 영상 첨부 목록을 보여준다.
- S/O 분류가 어렵다면 “확인 필요”로 표시한다.
- 진단명, 병명 추측, 치료 추천은 넣지 않는다.
- “AI 요약”이라는 표현을 쓰지 않는다.
- 화면 제목은 “입력 내용 정리”로 한다.

## 7. Hugging Face 호출 방식

1차 데모에서는 Hugging Face를 **무료 사용 범위 안에서만** 사용한다.

확정 방식:

- Next.js Route Handler에서만 Hugging Face를 호출한다.
- 브라우저에서는 Hugging Face 토큰을 절대 사용하지 않는다.
- 호출 방식은 Hugging Face Inference Providers의 OpenAI 호환 Chat Completions API를 우선 사용한다.
- HTTP 엔드포인트는 `https://router.huggingface.co/v1/chat/completions`를 사용한다.
- 모델 기본값은 `google/medgemma-1.5-4b-it`를 사용한다.
- 유료 Inference Endpoint는 만들지 않는다.
- Hugging Face PRO, 유료 GPU, Vertex AI는 사용하지 않는다.

공식 문서 기준:

- Hugging Face Inference Providers는 하나의 Hugging Face 토큰으로 여러 제공자를 거쳐 모델을 호출할 수 있다.
- Chat Completions는 OpenAI 호환 형식으로 호출할 수 있다.
- 구조화된 출력은 `response_format`과 JSON Schema를 사용할 수 있다.
- 무료 사용자는 월별 무료 크레딧이 있지만, 무료 크레딧 양과 정책은 바뀔 수 있다.
- MedGemma 모델은 사용 전에 Hugging Face에서 모델 사용 조건에 동의해야 한다.

### 환경 변수

```text
HUGGINGFACE_API_TOKEN=
HUGGINGFACE_MODEL_ID=google/medgemma-1.5-4b-it
HUGGINGFACE_API_BASE_URL=https://router.huggingface.co/v1
HUGGINGFACE_PROVIDER_POLICY=auto
HUGGINGFACE_TIMEOUT_MS=30000
```

규칙:

- `HUGGINGFACE_API_TOKEN`은 서버에서만 읽는다.
- `HUGGINGFACE_API_BASE_URL`은 기본값을 코드에 둘 수 있다.
- `HUGGINGFACE_PROVIDER_POLICY`는 기본 `auto`로 둔다.
- 비용을 더 줄여야 할 때만 모델 id에 `:cheapest` 정책을 붙이는 방식을 검토한다.
- 토큰이 없으면 AI 호출을 하지 않고 수동 요약으로 보낸다.

### 요청 방식

서버에서는 `fetch`를 사용해 직접 호출한다.

기본 요청:

```ts
type HuggingFaceChatRequest = {
  model: string;
  messages: HuggingFaceMessage[];
  temperature: number;
  max_tokens: number;
  stream: false;
  response_format?: HuggingFaceResponseFormat;
};

type HuggingFaceMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};
```

HTTP 요청:

