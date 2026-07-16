> [문서 인덱스](../2026-07-10-medical-interview-pwa-implementation-detail.md)
> 이전: [6. Next.js API 설계](./006-6-next-js-api-설계.md)
> 다음: [S/O 요약 생성 요청](./008-s-o-요약-생성-요청.md)


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

```ts
await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(requestBody),
  signal: abortSignal,
});
```

생성 옵션:

| 용도 | temperature | max_tokens |
|---|---:|---:|
| 다음 질문 생성 | 0.2 | 700 |
| S/O 요약 생성 | 0.1 | 1400 |
| 재시도 | 0 | 900 |

규칙:

- 질문과 요약 모두 `stream: false`로 호출한다.
- 응답 대기 시간은 30초로 둔다.
- 타임아웃이 나면 `NETWORK_ERROR` 또는 `HF_UNAVAILABLE`로 처리한다.
- 같은 요청은 자동으로 여러 번 반복하지 않는다.
- JSON 파싱 실패일 때만 1회 재시도한다.

### 모델 id 규칙

기본 모델:

```text
google/medgemma-1.5-4b-it
```

정책:

- 기본은 모델 id를 그대로 사용한다.
- Hugging Face 라우터가 자동으로 가능한 제공자를 선택하게 둔다.
- 비용 문제가 있으면 `google/medgemma-1.5-4b-it:cheapest`를 실험한다.
- 특정 provider 고정은 1차 데모에서 하지 않는다.

모델 접근 조건:

- Hugging Face 계정에서 MedGemma 사용 조건에 동의해야 한다.
- 토큰은 해당 모델을 호출할 권한이 있어야 한다.
- 권한이 없으면 앱은 `HF_UNAVAILABLE`로 처리하고 수동 요약을 보여준다.

### 텍스트 질문 생성 요청

질문 생성에는 텍스트만 보낸다.

포함:

- 시스템 프롬프트
- 현재 문진 상태
- 저장된 기본 프로필과 의료정보 중 필요한 것
- 현재 문진 답변
- 질문 수
- 이미 물어본 질문

제외:
