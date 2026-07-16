> [문서 인덱스](../2026-07-10-medical-interview-pwa-implementation-detail.md)
> 이전: [상태 설명](./005-상태-설명.md)
> 다음: [7. Hugging Face 호출 방식](./007-7-hugging-face-호출-방식.md)


- 진단명은 말하지 않는다.
- “응급입니다”처럼 확정하지 않는다.
- “위험 신호가 있어요”라고 안내한다.
- 강한 위험 신호가 있으면 일반 문진보다 안전 안내를 먼저 보여준다.
- 사용자가 확인하기 전까지 다음 일반 질문으로 넘어가지 않는다.
- 문진을 계속할 수는 있지만, 도움 요청 버튼을 더 크게 보여준다.

위험 신호는 앱의 규칙 기반 안전 레이어가 먼저 확인한다.  
MedGemma가 위험 여부를 단독으로 판단하지 않는다.

위험 신호 단계:

| 단계 | 의미 | 처리 |
|---|---|---|
| 없음 | 특별한 위험 신호가 없음 | 일반 문진 진행 |
| `caution` | 주의가 필요한 신호 | 문진은 계속하되 안전 안내 표시 |
| `urgent` | 강한 위험 신호 | 안전 안내를 먼저 보여주고 확인 전까지 일반 문진 중단 |

`caution` 예:

- 고열
- 심한 통증
- 반복 구토
- 증상이 빠르게 나빠짐
- 탈수 의심 표현

`urgent` 예:

- 가슴 통증과 숨참, 식은땀, 팔/턱 통증이 함께 있음
- 갑자기 한쪽 팔이나 다리에 힘이 빠짐
- 말이 어눌하거나 말을 이해하기 어려움
- 의식이 흐리거나 쓰러짐
- 심한 호흡곤란
- 갑작스럽고 매우 심한 두통
- 피가 많이 남
- 얼굴이나 목이 붓고 숨쉬기 어려움

`urgent` 안내 문구:

```text
위험 신호가 있어요.
이 앱은 진단하지 않지만, 지금은 문진보다 도움 요청이 먼저일 수 있어요.
주변 사람에게 알리거나 119에 연락하세요.
```

버튼:

- `119에 전화하기`
- `주변 사람에게 보여주기`
- `그래도 문진 계속하기`

버튼 강조 규칙:

- `119에 전화하기`를 가장 크게 보여준다.
- `주변 사람에게 보여주기`를 두 번째로 보여준다.
- `그래도 문진 계속하기`는 가장 덜 강조한다.

문진 계속 규칙:

- 사용자가 이미 병원에 있거나 도움을 받은 상태일 수 있으므로 문진 계속은 막지 않는다.
- 하지만 `urgent` 안내는 사용자가 확인해야 닫힌다.
- `urgent` 안내가 뜬 사실은 문진 기록의 `safetyNotice`에 저장한다.

## 6. Next.js API 설계

서버 API는 Hugging Face 토큰을 숨기기 위해 필요하다.

### `POST /api/ai/question`

역할:

- 현재 문진 내용을 보고 다음 질문을 만든다.
- 질문이 더 필요 없으면 요약 생성으로 넘어가라고 알려준다.
- 의료정보 장기 저장 후보가 있으면 함께 알려준다.

요청:

```ts
type QuestionApiRequest = {
  interviewId: string;
  profile: {
    age?: number;
    sex?: string;
    medicalProfile?: MedicalProfileForAi;
  };
  messages: InterviewMessageForAi[];
  measurements: Measurement[];
  attachments: AttachmentForAi[];
  questionCount: number;
};
```

응답:

```ts
type QuestionApiResponse = {
  ok: true;
  action: "ask_next" | "show_safety_notice" | "ready_for_summary";
  nextQuestion?: {
    id: string;
    text: string;
    answerType: "free_text" | "yes_no_unknown" | "measurement";
    target?: "symptom" | "duration" | "severity" | "trigger" | "medication" | "history" | "measurement";
  };
  saveCandidates: SaveCandidate[];
  safetyNotice?: SafetyNotice;
};
```

응답 처리 규칙:

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
