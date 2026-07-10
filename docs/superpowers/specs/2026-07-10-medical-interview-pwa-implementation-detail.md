# 의료 취약군 문진 보조 앱 구현 상세 설계서

작성일: 2026-07-10

이 문서는 구현을 위한 상세 설계서다.  
제품의 목적, 사용자, 화면 기준, 제외 범위는 기존 설계문서를 따른다.  
기존 설계문서와 내용이 다르면 기존 설계문서를 우선한다.

기준 문서:

- `docs/superpowers/specs/2026-07-10-medical-interview-pwa-design.md`

## 1. 이 문서에서 정하는 것

이 문서는 디자인을 정하지 않는다.

이 문서에서 정하는 것은 아래 내용이다.

- 어떤 데이터를 저장할지
- 문진이 어떤 순서로 진행되는지
- IndexedDB에 어떤 저장소를 만들지
- Next.js 서버 API를 어떻게 나눌지
- MedGemma에 어떤 정보를 보낼지
- MedGemma가 어떤 형식으로 답해야 하는지
- 실패했을 때 어떻게 처리할지
- 구현이 끝났는지 어떻게 확인할지

## 2. 전체 구조

앱은 크게 4부분으로 나눈다.

1. 화면
2. 로컬 저장소
3. 서버 API
4. MedGemma 연결

흐름은 아래와 같다.

```text
사용자 입력
→ 브라우저에서 문진 상태 저장
→ 필요한 경우 Next.js 서버 API 호출
→ 서버 API가 Hugging Face MedGemma 호출
→ 앱이 질문 또는 요약을 저장
→ 사용자가 의료진용 요약을 확인
```

중요한 원칙:

- 사용자의 이름, 연락처, 주민등록번호는 받지 않는다.
- Hugging Face 토큰은 브라우저에 두지 않는다.
- MedGemma는 진단하지 않는다.
- MedGemma는 S/O 요약 초안만 만든다.
- 모든 개인 데이터는 사용자 기기에 저장한다.
- 별도 데이터베이스는 만들지 않는다.

## 3. 데이터 모델

아래 타입 이름은 구현할 때 TypeScript 타입 이름으로 사용할 수 있다.

### 기본 프로필

기본 프로필은 사용자를 구분하거나 진료에 참고할 최소 정보다.

키와 몸무게는 기본 프로필이 아니다.  
키와 몸무게는 의료정보에 저장한다.

```ts
type BasicProfile = {
  id: "default";
  birthDate?: string;
  age?: number;
  ageRecordedAt?: string;
  sex?: "female" | "male" | "other" | "unknown";
  createdAt: string;
  updatedAt: string;
};
```

규칙:

- `birthDate`와 `age` 중 하나만 있어도 된다.
- 나이는 만 나이로 계산한다.
- 생년월일이 있으면 앱이 오늘 날짜 기준으로 만 나이를 계산한다.
- 사용자가 나이만 직접 입력한 경우, 입력한 나이를 만 나이로 본다.
- 사용자가 나이만 직접 입력하면 `ageRecordedAt`에 입력 날짜를 저장한다.
- 사용자가 모르면 `age`와 `birthDate`를 비워둘 수 있다.
- `sex`를 모르면 `unknown`으로 저장한다.

만 나이 계산 규칙:

- 현재 연도에서 출생 연도를 뺀다.
- 올해 생일이 아직 지나지 않았으면 1을 더 뺀다.
- 예: 생년월일이 `2010-09-01`이고 오늘이 `2026-07-10`이면 만 나이는 15세다.

### 의료정보

의료정보는 다음 문진에서도 다시 참고할 수 있는 정보다.

```ts
type MedicalProfile = {
  id: "default";
  heightCm?: number;
  weightKg?: number;
  conditions: MedicalTextItem[];
  medications: MedicalTextItem[];
  allergies: MedicalTextItem[];
  familyHistories: MedicalTextItem[];
  procedures: MedicalTextItem[];
  smoking?: "yes" | "no" | "unknown";
  drinking?: "yes" | "no" | "unknown";
  createdAt: string;
  updatedAt: string;
};

type MedicalTextItem = {
  id: string;
  label: string;
  note?: string;
  source: "user_profile" | "interview_saved";
  createdAt: string;
  updatedAt: string;
};
```

규칙:

- 키는 `heightCm`에 cm 단위로 저장한다.
- 몸무게는 `weightKg`에 kg 단위로 저장한다.
- 복용약, 알레르기, 가족력, 기존 질환은 여러 개 저장할 수 있다.
- 문진 중 새로 알게 된 의료정보는 사용자가 허락해야 저장한다.

### 문진 기록

문진 기록은 한 번의 문진 전체를 담는다.

```ts
type InterviewRecord = {
  id: string;
  status: InterviewStatus;
  chiefComplaint?: string;
  startedAt: string;
  completedAt?: string;
  profileSnapshot: ProfileSnapshot;
  messages: InterviewMessage[];
  measurements: Measurement[];
  attachments: AttachmentMeta[];
  saveCandidates: SaveCandidate[];
  summary?: MedicalSummary;
  safetyNotice?: SafetyNotice;
  aiFailure?: AiFailure;
  createdAt: string;
  updatedAt: string;
};

type InterviewStatus =
  | "draft"
  | "collecting"
  | "waiting_ai_question"
  | "waiting_user_answer"
  | "showing_safety_notice"
  | "checking_save_candidates"
  | "generating_summary"
  | "completed"
  | "failed";
```

규칙:

- `profileSnapshot`에는 문진 당시 참고한 기본 프로필과 의료정보를 복사해 둔다.
- 이후 의료정보가 바뀌어도 과거 문진 요약이 흔들리지 않게 하기 위해서다.
- 체온, 혈압, 혈당은 `measurements`에 저장한다.
- 체온, 혈압, 혈당은 의료정보에 저장하지 않는다.

### 안전 안내

위험 신호가 보일 때 보여주는 안내다.

```ts
type SafetyNotice = {
  id: string;
  level: "caution" | "urgent";
  trigger: SafetyTrigger;
  message: string;
  actions: SafetyAction[];
  acknowledgedAt?: string;
  createdAt: string;
};

type SafetyTrigger =
  | "chest_pain_with_breathing_or_sweat"
  | "stroke_like_symptoms"
  | "loss_of_consciousness"
  | "severe_breathing_difficulty"
  | "sudden_severe_headache"
  | "heavy_bleeding"
  | "severe_allergic_reaction"
  | "severe_pain_or_worsening"
  | "other_risk_signal";

type SafetyAction =
  | "call_119"
  | "show_to_nearby_person"
  | "continue_interview";
```

규칙:

- `level`이 `caution`이면 문진을 계속하면서 안내를 보여준다.
- `level`이 `urgent`이면 일반 문진보다 안전 안내를 먼저 보여준다.
- `urgent` 안내는 사용자가 확인하기 전까지 다음 일반 질문으로 넘어가지 않는다.
- `continue_interview`는 제공할 수 있지만 가장 덜 강조한다.
- 안전 안내는 진단이 아니다.

### 문진 메시지

문진 중 오간 말과 답변을 저장한다.

```ts
type InterviewMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  inputType: "text" | "voice" | "photo" | "video" | "choice" | "system";
  text?: string;
  originalTranscript?: string;
  choiceValue?: "yes" | "no" | "unknown";
  attachmentIds?: string[];
  questionId?: string;
  createdAt: string;
};
```

규칙:

- 음성 입력도 텍스트로 변환한 뒤 `text`에 저장한다.
- 사용자가 음성 인식 결과를 고치면 고친 문장을 저장한다.
- `originalTranscript`에는 음성 인식이 처음 만든 문장을 저장할 수 있다.
- 사용자가 문장을 고치면 `text`에는 고친 문장을 저장한다.
- AI에는 `text`만 보낸다.
- 사진이나 영상은 메시지 안에 직접 저장하지 않는다.
- 메시지는 첨부 파일 id만 가진다.

### 측정값

측정값은 그날 문진에만 저장한다.

```ts
type Measurement = {
  id: string;
  type: "temperature" | "blood_pressure" | "blood_glucose" | "oxygen_saturation";
  valueText: string;
  measuredAt?: string;
  source: "user_entered";
  createdAt: string;
};
```

예:

- 체온: `37.8도`
- 혈압: `130/85`
- 혈당: `식후 180`
- 산소포화도: `96%`

### 첨부 파일

첨부 파일 정보는 메타데이터와 실제 파일을 나누어 저장한다.

```ts
type AttachmentMeta = {
  id: string;
  interviewId: string;
  kind: "photo" | "video";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  originalSizeBytes?: number;
  storedBlobId: string;
  previewBlobId?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  aiTransferStatus?: "not_allowed" | "allowed" | "sent" | "failed";
  createdAt: string;
};
```

규칙:

- 사진은 압축한 파일만 저장한다.
- 원본 사진은 저장하지 않는다.
- 영상은 분석하지 않는다.
- 영상은 첨부 목록에만 보여준다.
- `originalSizeBytes`는 압축 전 파일 크기를 기록할 때 사용한다.
- `durationSeconds`는 영상 길이를 확인할 수 있을 때만 저장한다.
- `aiTransferStatus`는 사진이 MedGemma로 보내졌는지 표시한다.

### 앱 설정

앱 설정은 동의 상태와 잠금 상태를 저장한다.

```ts
type AppSettings = {
  id: "default";
  consent: ConsentSettings;
  lock: LockSettings;
  updatedAt: string;
};

type ConsentSettings = {
  localStorageConsent: ConsentState;
  aiTextTransferConsent: ConsentState;
  photoAiTransferConsent: ConsentState;
};

type ConsentState = {
  granted: boolean;
  version: string;
  decidedAt?: string;
};

type LockSettings = {
  enabled: boolean;
  method?: "pin";
  pinHash?: string;
  pinSalt?: string;
  failedAttempts: number;
  lockedUntil?: string;
  lastUnlockedAt?: string;
  updatedAt: string;
};
```

규칙:

- 회원가입은 만들지 않는다.
- 잠금은 이 브라우저 안의 기록을 가리는 기능이다.
- PIN 원문은 저장하지 않는다.
- PIN은 salt를 붙여 해시로 저장한다.
- PIN을 잊어버리면 복구하지 않는다.
- PIN을 잊어버린 사용자는 앱 데이터를 초기화해야 한다.
- 현재 웹 프로토타입의 잠금은 강한 보안 기능이 아니라 화면 접근을 막는 데모 기능이다.
- 추후 iOS Native에서는 Keychain과 Face ID/Touch ID를 우선 검토한다.

### 앱 오류

앱 오류는 사용자에게 보여줄 오류 상태를 말한다.

```ts
type AppErrorCode =
  | "HF_RATE_LIMIT"
  | "HF_MODEL_LOADING"
  | "HF_UNAVAILABLE"
  | "INVALID_AI_OUTPUT"
  | "NETWORK_ERROR"
  | "AI_CONSENT_REQUIRED"
  | "PHOTO_AI_CONSENT_REQUIRED"
  | "MIC_PERMISSION_DENIED"
  | "SPEECH_NOT_SUPPORTED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "TOO_MANY_ATTACHMENTS"
  | "STORAGE_QUOTA_EXCEEDED"
  | "INDEXEDDB_UNAVAILABLE"
  | "LOCK_FAILED"
  | "UNKNOWN_ERROR";

type AppError = {
  code: AppErrorCode;
  message: string;
  retryable: boolean;
  canContinueInterview: boolean;
  canUseManualSummary: boolean;
  createdAt: string;
};
```

규칙:

- 오류 메시지는 짧고 쉬운 말로 보여준다.
- 오류 코드와 시간은 남길 수 있다.
- 문진 본문, 사진, 의료정보는 오류 로그에 남기지 않는다.
- 사용자가 계속할 수 있는 길을 같이 보여준다.

### 의료정보 장기 저장 후보

문진 중 새로 알게 된 정보를 앞으로도 의료정보에 저장할지 물어보기 위한 데이터다.

이 데이터는 모든 문진 저장 후보가 아니다.  
정확히는 **의료정보에 계속 저장할지 확인해야 하는 후보**다.

```ts
type SaveCandidate = {
  id: string;
  category:
    | "height"
    | "weight"
    | "condition"
    | "medication"
    | "allergy"
    | "family_history"
    | "procedure"
    | "smoking"
    | "drinking";
  value: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  decidedAt?: string;
};
```

규칙:

- MedGemma는 의료정보 장기 저장 후보를 제안할 수 있다.
- MedGemma가 직접 저장하지 않는다.
- 앱이 사용자에게 물어본다.
- 사용자가 `저장하기`를 누르면 의료정보에 저장한다.
- 사용자가 `이번 문진에만 사용`을 누르면 문진 기록에만 남긴다.

묻지 않고 문진 기록에 저장하는 정보:

- 오늘 증상
- 오늘 통증 정도
- 오늘 증상 변화
- 오늘 잰 체온
- 오늘 잰 혈압
- 오늘 잰 혈당
- 오늘 첨부한 사진
- 오늘 첨부한 영상

위 정보는 이번 문진을 만들기 위해 입력한 내용이다.  
따라서 매번 저장 여부를 다시 묻지 않는다.

저장 여부를 물어봐야 하는 정보:

- 키
- 몸무게
- 복용약
- 알레르기
- 기존 질환
- 가족력
- 수술/시술 이력
- 흡연/음주 여부

이 정보는 다음 문진에서도 계속 참고할 수 있다.  
그래서 의료정보에 저장하기 전에 사용자에게 확인한다.

필수에 가까운 의료정보라도 규칙은 같다.

```text
현재 문진에 필요해서 질문한다: 가능
이번 문진 기록에 저장한다: 별도 확인 없이 저장
앞으로 의료정보에 계속 저장한다: 사용자 확인 필요
```

관찰이 필요한 정보는 보통 문진 기록에만 저장한다.

예:

- 오늘 체온
- 오늘 혈압
- 오늘 혈당
- 오늘 증상 사진
- 오늘 통증 정도

이런 정보는 시간이 지나면 의미가 바뀐다.  
그래서 의료정보에 계속 저장하지 않는다.

### 의료진용 요약

```ts
type MedicalSummary = {
  id: string;
  interviewId: string;
  summaryType: "ai";
  reasonForVisit: string;
  subjective: SummaryItem[];
  objective: SummaryItem[];
  originalUserText: string[];
  attachments: SummaryAttachment[];
  safetyNotice?: SafetyNotice;
  needsCheckItems: SummaryItem[];
  cautionText: string;
  createdAt: string;
};

type SummaryItem = {
  id: string;
  label: string;
  value: string;
  sourceMessageIds?: string[];
  needsCheck?: boolean;
};

type SummaryAttachment = {
  attachmentId: string;
  kind: "photo" | "video";
  label: string;
};
```

규칙:

- `subjective`에는 사용자가 직접 말한 증상과 경험을 넣는다.
- `objective`에는 사용자가 제공한 객관 참고 정보를 넣는다.
- 병명, 진단명, 치료 추천은 넣지 않는다.
- 확실하지 않은 것은 `needsCheck: true`로 표시한다.
- `needsCheckItems`에는 의료진 확인이 필요한 항목을 모아둔다.
- 위험 신호 안내가 있었으면 `safetyNotice`를 함께 보여준다.
- `cautionText`에는 “AI 요약은 의료진 참고용 초안입니다.”를 넣는다.

### 수동 요약

수동 요약은 AI를 쓰지 않고 앱이 입력 내용을 규칙대로 정리한 것이다.

AI가 실패했거나 사용자가 AI 전송에 동의하지 않았을 때 사용한다.  
수동 요약은 “AI 요약”이라고 부르지 않는다.  
화면에는 **입력 내용 정리**라고 표시한다.

```ts
type ManualSummary = {
  id: string;
  interviewId: string;
  summaryType: "manual";
  title: "입력 내용 정리";
  reasonForVisit?: string;
  symptomTextItems: ManualSummaryItem[];
  measurementItems: ManualSummaryItem[];
  medicalInfoItems: ManualSummaryItem[];
  attachmentItems: SummaryAttachment[];
  originalUserText: string[];
  safetyNotice?: SafetyNotice;
  cautionText: string;
  createdAt: string;
};

type ManualSummaryItem = {
  id: string;
  label: string;
  value: string;
  source: "user_input" | "profile_snapshot" | "measurement" | "attachment";
  needsCheck?: boolean;
};
```

규칙:

- 수동 요약은 병명이나 진단명을 만들지 않는다.
- 수동 요약은 S/O를 억지로 판단하지 않는다.
- 사용자가 입력한 내용과 저장된 참고 정보만 정리한다.
- 분류가 애매하면 “확인 필요”로 표시한다.
- 사진은 “사진 첨부 있음, 의료진 확인 필요”로 표시한다.
- 영상은 “영상 첨부 있음”으로만 표시한다.
- `cautionText`에는 “이 정리는 AI가 만든 요약이 아니며, 사용자가 입력한 내용을 보기 쉽게 모은 것입니다.”를 넣는다.

## 4. IndexedDB 저장 구조

IndexedDB 이름:

```text
koddi-ud-eum
```

버전:

```text
1
```

저장소:

| 저장소 | 키 | 내용 |
|---|---|---|
| `basicProfile` | `id` | 기본 프로필 |
| `medicalProfile` | `id` | 의료정보 |
| `interviews` | `id` | 문진 기록 |
| `attachments` | `id` | 첨부 파일 정보 |
| `blobs` | `id` | 압축 사진, 영상 파일 |
| `settings` | `id` | 동의, 잠금 설정 |

인덱스:

- `interviews.createdAt`
- `interviews.status`
- `attachments.interviewId`
- `attachments.kind`

삭제 규칙:

- 특정 문진 삭제: 해당 `interviews` 1개와 연결된 `attachments`, `blobs`를 삭제한다.
- 모든 기록 삭제: 모든 `interviews`, `attachments`, `blobs`를 삭제한다.
- 기본 프로필 삭제: `basicProfile.default`만 삭제한다.
- 의료정보 삭제: `medicalProfile.default`만 삭제한다.
- 설정 삭제: `settings`를 초기화한다.

### 현재 웹 프로토타입 저장 기준

현재 1차 프로토타입은 데스크탑 또는 노트북에서 Next.js 웹으로 구현한다.

이 단계의 목표는 최종 저장 전략을 확정하는 것이 아니다.  
문진 작성, AI 질문, S/O 요약, 기록 확인 흐름이 실제로 가능한지 검증하는 것이다.

현재 프로토타입 저장 방식:

- 기본 프로필: 브라우저 IndexedDB
- 의료정보: 브라우저 IndexedDB
- 문진 기록: 브라우저 IndexedDB
- 사진/영상 첨부: IndexedDB Blob
- 간단한 설정: localStorage 또는 IndexedDB
- 앱 파일 캐시: PWA Cache Storage

웹/PWA 저장의 한계:

- 일반 폴더에 앱이 자동으로 파일을 만들지 않는다.
- 같은 사이트 주소에서 접속해야 기존 기록을 볼 수 있다.
- 같은 기기라도 브라우저가 다르면 기록이 다를 수 있다.
- 브라우저 데이터를 삭제하면 기록도 사라질 수 있다.
- 시크릿 모드에서는 기록이 오래 유지되지 않을 수 있다.
- 기기를 바꾸면 기록이 자동으로 옮겨지지 않는다.

따라서 현재 웹 프로토타입의 IndexedDB 저장은 **프로토타입 검증용 저장 방식**이다.  
최종 iOS 앱의 저장 방식으로 보지 않는다.

### 웹 프로토타입의 보완 저장 기능

브라우저 저장의 한계를 줄이기 위해 내보내기 기능을 둔다.

1차 데모에서 권장하는 보완 기능:

- 의료진용 요약 PDF 내보내기
- 문진 기록 JSON 백업 내보내기
- 문진 기록 JSON 백업 가져오기

사용자 안내 문구:

```text
이 기록은 현재 기기의 이 브라우저에 저장돼요.
브라우저 데이터를 삭제하면 기록도 사라질 수 있어요.
중요한 문진은 PDF로 저장해 주세요.
```

주의:

- 웹앱이 스마트폰이나 노트북의 파일 폴더를 마음대로 만들고 계속 저장하지 않는다.
- 파일 저장은 사용자가 `내보내기`를 누를 때만 한다.
- 백업 가져오기는 사용자가 직접 파일을 선택해야 한다.

### 추후 iOS Native 저장 기준

추후 제품화 단계에서는 iOS Native 앱을 만든다.

iOS Native에서는 IndexedDB 대신 iOS 앱 내부 저장소를 사용한다.

예상 저장 방식:

| 데이터 | iOS Native 저장 방식 |
|---|---|
| 기본 프로필 | Core Data 또는 SQLite |
| 의료정보 | Core Data 또는 SQLite |
| 문진 기록 | Core Data 또는 SQLite |
| 사진/영상 첨부 | 앱 Sandbox 내부 파일 저장소 |
| 잠금 PIN/민감 설정 | Keychain |
| 의료진용 요약 PDF | Files 앱으로 내보내기 |
| 백업 파일 | iCloud Drive 또는 파일 앱 내보내기 검토 |

iOS Native 전환 시 다시 정해야 하는 것:

- iCloud 백업을 허용할지
- 앱 삭제 시 데이터를 어떻게 안내할지
- 기기 변경 시 백업/복구를 어떻게 할지
- Face ID/Touch ID를 기본 잠금으로 둘지, PIN을 보조 수단으로 둘지
- 의료정보와 첨부 파일을 암호화할지

정확한 표현:

```text
현재 웹 프로토타입은 기기 브라우저 저장 기반이다.
추후 iOS Native 앱은 iOS 앱 내부 저장소 기반으로 다시 설계한다.
저장은 기기 중심으로 하되, AI 처리는 Hugging Face MedGemma 클라우드 연동을 사용한다.
```

## 5. 문진 상태 흐름

문진은 아래 상태를 가진다.

```text
draft
→ collecting
→ waiting_ai_question
→ waiting_user_answer
→ showing_safety_notice
→ checking_save_candidates
→ generating_summary
→ completed
```

`showing_safety_notice`는 강한 위험 신호가 있을 때만 들어간다.  
실패하면 언제든 `failed`가 될 수 있다.

### 상태 설명

| 상태 | 뜻 | 다음 상태 |
|---|---|---|
| `draft` | 문진 기록을 만들었지만 아직 답변이 거의 없음 | `collecting` |
| `collecting` | 사용자가 첫 증상, 사진, 음성, 선택지를 입력 중 | `waiting_ai_question` |
| `waiting_ai_question` | 앱이 AI 질문을 기다리는 중 | `waiting_user_answer` |
| `waiting_user_answer` | 사용자가 AI 질문에 답하는 중 | `waiting_ai_question`, `showing_safety_notice`, `checking_save_candidates` |
| `showing_safety_notice` | 강한 위험 신호가 보여 안전 안내를 먼저 보여주는 중 | `waiting_ai_question`, `checking_save_candidates`, `generating_summary` |
| `checking_save_candidates` | 새 의료정보 저장 여부를 묻는 중 | `generating_summary` |
| `generating_summary` | S/O 요약을 만드는 중 | `completed` |
| `completed` | 문진 완료 | 없음 |
| `failed` | 계속 진행할 수 없는 오류 | 다시 시도 또는 수동 요약 |

### 질문 수 규칙

- 중심 질문은 기본 4~5개 안에서 끝낸다.
- 사용자가 충분히 답했으면 4개보다 적어도 요약으로 넘어갈 수 있다.
- 중요한 정보가 부족하면 5개까지 질문할 수 있다.
- 5개를 넘겨야 할 것 같으면 추가 질문 대신 “확인 필요”로 요약에 표시한다.
- 단, 사용자가 직접 더 말하고 싶어 하면 추가 입력은 받을 수 있다.

### 증상 질문 로직

MedGemma가 문진 로직 전체를 결정하지 않는다.

앱이 아래 정보를 관리한다.

- 현재 질문 수
- 이미 답한 정보
- 저장된 기본 프로필
- 저장된 의료정보
- 현재 문진에 첨부된 사진과 영상
- 체온, 혈압, 혈당 같은 측정값 여부
- 요약에 필요한 빈칸

MedGemma는 이 상태를 보고 다음 질문 1개를 제안한다.

질문은 병명 기준이 아니라 아래 기준으로 고른다.

1. 주요 증상
2. 시작 시점
3. 위치
4. 정도
5. 변화
6. 좋아지거나 나빠지는 상황
7. 함께 나타난 증상
8. 복용약, 알레르기, 기존 질환 같은 참고 정보
9. 필요할 때만 체온, 혈압, 혈당 같은 측정값

이 방식은 빈칸을 채우는 방식이다.

예:

```text
주요 증상: 있음
시작 시점: 없음
위치: 있음
정도: 없음
변화: 없음
복용약: 저장됨
알레르기: 저장 안 됨
측정값: 현재 증상에 필요할 때만
```

MedGemma는 비어 있는 항목 중 의료진에게 가장 도움이 되는 질문 1개만 고른다.

중요한 규칙:

- 병명 후보를 사용자에게 말하지 않는다.
- 진단 가능성을 출력하지 않는다.
- 여러 상황을 열어두고 필요한 정보를 묻는다.
- 질문은 증상, 시간, 위치, 정도, 변화, 동반 증상, 측정값 기준으로 한다.
- 저장된 정보는 기본값으로 참고하되, 바뀔 수 있거나 현재 증상과 관련이 크면 확인할 수 있다.
- 이미 이번 문진에서 답한 정보는 반복해서 묻지 않는다.

예:

```text
사용자 입력: 어지러워요.

좋은 질문:
언제부터 어지러웠나요?
가만히 있어도 어지러운가요, 움직일 때 더 심한가요?
함께 나타난 증상이 있나요? 예: 두통, 구토, 숨참, 한쪽 팔다리 힘 빠짐
오늘 혈압이나 혈당을 잰 값이 있나요?

나쁜 질문:
빈혈 가능성이 있어서 어지러운 건가요?
뇌졸중 증상일 수 있어서 한쪽 팔다리에 힘이 빠지나요?
```

질문 검증:

- 서버는 MedGemma 질문이 병명이나 진단 가능성을 말하는지 확인한다.
- 병명이나 진단 가능성이 들어가면 질문을 다시 만들거나 실패 처리한다.
- 질문이 2개 이상이면 하나만 남기거나 실패 처리한다.

### 저장 정보 재확인 규칙

저장된 정보가 있다고 해서 항상 다시 묻지 않는 것은 아니다.

저장된 정보는 먼저 기본값으로 참고한다.  
그 뒤 아래 기준에 따라 확인 질문을 할 수 있다.

다시 확인할 수 있는 정보:

- 복용약
- 알레르기
- 몸무게
- 흡연/음주 여부
- 최근 수술/시술 이력
- 현재 증상과 관련 있는 기존 질환
- 현재 증상과 관련 있는 가족력

다시 확인하는 이유:

- 시간이 지나며 바뀔 수 있다.
- 현재 증상과 관련이 클 수 있다.
- 변화 과정이 진료에 중요할 수 있다.
- 저장된 날짜가 오래됐을 수 있다.

확인 질문 예:

```text
저장된 복용약 정보가 지금도 맞나요?
최근에 새로 먹기 시작한 약이 있나요?
저장된 알레르기 정보 외에 새로 알게 된 알레르기가 있나요?
최근 몸무게가 크게 변했나요?
```

묻지 않는 것이 좋은 경우:

- 이번 문진에서 이미 답했다.
- 현재 증상과 관련이 낮다.
- 질문 수가 이미 5개에 가까워 요약으로 넘어가는 편이 낫다.
- 사용자에게 부담이 큰 질문인데 요약에 꼭 필요하지 않다.

프롬프트 규칙:

```text
저장된 정보는 기본값으로 참고한다.
하지만 복용약, 알레르기, 몸무게처럼 바뀔 수 있는 정보는 현재 증상과 관련이 있으면 짧게 확인할 수 있다.
이미 이번 문진에서 답한 내용은 반복해서 묻지 않는다.
```

### `예 / 아니오 / 모르겠음` 처리

- `예`: 필요한 값을 입력받거나 다음 세부 질문으로 간다.
- `아니오`: 해당 정보가 없다고 기록하고 다음 질문으로 간다.
- `모르겠음`: 모른다고 기록하고 다음 질문으로 간다.

`아니오`와 `모르겠음`은 문진을 막지 않는다.

### 위험 신호 처리

앱은 응급 여부를 진단하거나 확정하지 않는다.

하지만 위험 신호가 입력되면 그냥 넘어가지 않는다.  
위험 신호 안내는 진단이 아니라 도움 요청 안내다.

중요한 원칙:

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

## 7. 동의와 개인정보 전송 범위

동의는 한 번에 뭉쳐서 받지 않는다.

사용자가 무엇을 허용하는지 알 수 있도록 아래 3개로 나눈다.

1. 로컬 저장 동의
2. AI 전송 동의
3. 사진 AI 전송 동의

### 동의 데이터

동의 정보는 `settings` 저장소에 저장한다.

```ts
type ConsentSettings = {
  id: "consent";
  localStorageConsent: ConsentState;
  aiTextTransferConsent: ConsentState;
  aiPhotoTransferConsent: ConsentState;
  backupExportNoticeAccepted?: ConsentState;
  updatedAt: string;
};

type ConsentState = {
  status: "granted" | "denied";
  version: string;
  decidedAt: string;
};
```

규칙:

- `version`은 동의 문구 버전이다.
- 동의 문구가 바뀌면 다시 동의를 받아야 한다.
- 사용자는 설정에서 동의를 바꿀 수 있어야 한다.
- 동의를 철회하면 이후 요청부터 적용한다.

### 로컬 저장 동의

로컬 저장 동의는 브라우저 IndexedDB에 저장하는 것에 대한 동의다.

저장되는 것:

- 기본 프로필
- 의료정보
- 문진 기록
- 첨부 파일
- 설정값

동의 문구:

```text
입력한 문진 내용은 이 기기의 이 브라우저에 저장돼요.
브라우저 데이터를 삭제하면 기록도 사라질 수 있어요.
```

동의하지 않은 경우:

- 문진을 임시로 작성할 수 있다.
- 브라우저를 닫으면 기록이 사라질 수 있다.
- 기록 목록에 저장하지 않는다.
- 의료정보를 다음 문진에 다시 사용하지 않는다.

### AI 전송 동의

AI 전송 동의는 텍스트 문진 정보와 필요한 의료정보 일부를 Hugging Face MedGemma로 보내는 것에 대한 동의다.

AI로 보낼 수 있는 정보:

- 나이
- 성별
- 키와 몸무게
- 기존 질환
- 복용약
- 알레르기
- 가족력
- 현재 증상
- 사용자가 입력한 문진 답변
- 오늘 잰 체온, 혈압, 혈당

AI로 보내지 않는 정보:

- 이름
- 연락처
- 주민등록번호
- 주소
- 병원 회원번호
- 기기 식별자
- 위치 정보
- 현재 문진과 관련 없는 과거 문진
- 전체 백업 파일
- 영상 파일

동의 문구:

```text
AI 질문과 요약을 만들기 위해 문진 내용 일부가 외부 AI 서비스로 전송될 수 있어요.
이름, 연락처, 주민등록번호는 보내지 않아요.
AI는 진단하지 않고 문진 정리만 도와요.
```

동의하지 않은 경우:

- MedGemma 질문 생성 기능을 사용하지 않는다.
- MedGemma 요약 생성 기능을 사용하지 않는다.
- 사용자는 글, 음성, 사진, 영상 첨부로 문진을 계속 작성할 수 있다.
- 앱은 수동 요약을 제공한다.
- 수동 요약은 “AI 요약”이 아니라 “입력 내용 정리”로 표시한다.

### 사진 AI 전송 동의

사진 AI 전송 동의는 첨부한 사진을 MedGemma 요청에 포함하는 것에 대한 동의다.

사진은 민감할 수 있다.  
그래서 텍스트 AI 전송 동의와 따로 받는다.

사진 처리 규칙:

- 사진은 압축한 파일만 보낸다.
- 원본 사진은 보내지 않는다.
- 영상은 보내지 않는다.
- 사진은 병명 판단용으로 보내지 않는다.
- 사진은 “의료진 확인용 첨부 참고 정보”로만 다룬다.

동의 문구:

```text
첨부한 사진을 AI 질문과 요약에 참고하게 할 수 있어요.
AI는 사진을 보고 병명을 말하지 않아요.
사진은 의료진이 직접 확인해야 해요.
```

동의하지 않은 경우:

- 사진은 문진 기록 첨부로만 저장한다.
- 사진을 MedGemma로 보내지 않는다.
- 요약에는 “사진 첨부 있음, 의료진 확인 필요”라고 표시한다.

추가 확인:

- 사진 AI 전송 동의가 있어도 첫 사진 전송 전에는 한 번 더 확인한다.
- 사용자는 사진별로 AI 전송을 끌 수 있어야 한다.

### 서버 전송 최소화

Next.js 서버 API는 AI 요청에 필요한 정보만 만든다.

규칙:

- 브라우저에 있는 전체 문진 기록을 그대로 보내지 않는다.
- AI 질문/요약에 필요한 필드만 골라 보낸다.
- 직접 식별정보가 섞이면 요청 전에 제거한다.
- 서버는 문진 본문을 저장하지 않는다.
- 서버 로그에는 문진 본문, 사진, 의료정보를 남기지 않는다.
- 오류 로그에는 오류 코드와 시간 정도만 남긴다.

### 동의 변경과 철회

사용자는 설정에서 동의를 바꿀 수 있어야 한다.

철회 규칙:

- AI 전송 동의를 철회하면 이후 AI 요청을 보내지 않는다.
- 사진 AI 전송 동의를 철회하면 이후 사진을 AI에 보내지 않는다.
- 로컬 저장 동의를 철회하면 새 기록을 저장하지 않는다.
- 이미 저장된 로컬 기록은 사용자가 직접 삭제할 수 있게 한다.

삭제 기능:

- 모든 문진 기록 삭제
- 기본 프로필 삭제
- 의료정보 삭제
- 첨부 파일 삭제
- 전체 로컬 데이터 삭제

### 동의 상태별 기능

| 상태 | 가능한 기능 | 제한 |
|---|---|---|
| 로컬 저장 동의 O, AI 전송 동의 O | AI 문진, AI 요약, 기록 저장 | 사진 AI 전송은 별도 동의 필요 |
| 로컬 저장 동의 O, AI 전송 동의 X | 수동 문진, 수동 요약, 기록 저장 | AI 질문/요약 사용 불가 |
| 로컬 저장 동의 X, AI 전송 동의 O | 임시 문진, AI 질문/요약 | 기록 저장 불가 |
| 로컬 저장 동의 X, AI 전송 동의 X | 임시 문진, 수동 요약 | 기록 저장과 AI 사용 불가 |

권장 기본 흐름:

1. 온보딩에서 로컬 저장 동의를 받는다.
2. AI 기능을 처음 사용할 때 AI 전송 동의를 받는다.
3. 사진을 AI에 처음 보낼 때 사진 AI 전송 동의를 받는다.

### 구현 완료 기준

- 로컬 저장 동의 상태가 저장된다.
- AI 전송 동의가 없으면 MedGemma API를 호출하지 않는다.
- 사진 AI 전송 동의가 없으면 사진을 MedGemma로 보내지 않는다.
- 이름, 연락처, 주민등록번호가 AI 요청에 포함되지 않는다.
- AI 동의를 거부해도 수동 문진과 수동 요약은 사용할 수 있다.
- 사용자가 설정에서 동의를 바꿀 수 있다.

## 8. 수동 요약 fallback

수동 요약은 AI가 없을 때도 의료진에게 보여줄 내용을 만드는 기능이다.

수동 요약의 목표:

- AI 없이도 문진 내용을 잃지 않는다.
- 사용자가 입력한 내용을 의료진이 빠르게 볼 수 있게 한다.
- AI 실패 때문에 문진 흐름이 완전히 막히지 않게 한다.

수동 요약이 아닌 것:

- AI 요약이 아니다.
- 진단이 아니다.
- S/O를 정확히 판단하는 기능이 아니다.
- 치료 방향을 제안하는 기능이 아니다.

### 수동 요약으로 전환하는 경우

아래 경우에는 수동 요약을 제공한다.

- 사용자가 AI 전송에 동의하지 않음
- Hugging Face 토큰이 없음
- Hugging Face 무료 사용량 초과
- 네트워크 오류
- MedGemma 모델 로딩 실패
- MedGemma 응답 형식 오류
- MedGemma 응답에 진단명 또는 치료 추천이 포함됨

화면 문구:

```text
AI 요약을 사용할 수 없어요.
대신 입력한 내용을 보기 쉽게 정리했어요.
```

AI 전송에 동의하지 않은 경우 문구:

```text
AI 전송에 동의하지 않아 입력 내용 정리로 보여드려요.
```

### 수동 요약 생성 규칙

수동 요약은 규칙 기반으로 만든다.

1. 사용자가 입력한 원문을 시간순으로 모은다.
2. 첫 번째 사용자 입력 또는 가장 긴 증상 입력을 `reasonForVisit` 후보로 사용한다.
3. 측정값은 `measurementItems`에 넣는다.
4. 기본 프로필과 의료정보 스냅샷은 `medicalInfoItems`에 넣는다.
5. 사진과 영상은 `attachmentItems`에 넣는다.
6. 위험 신호 안내가 있으면 `safetyNotice`에 넣는다.
7. 애매한 항목은 `needsCheck: true`로 표시한다.

수동 요약은 내용을 새로 추론하지 않는다.

금지:

- 병명 만들기
- 진단 가능성 쓰기
- 치료 추천 쓰기
- 사진 해석하기
- 사용자가 말하지 않은 내용 추가하기

### 수동 요약 화면 구조

수동 요약 화면 제목:

```text
입력 내용 정리
```

상단 안내:

```text
이 정리는 AI가 만든 요약이 아니에요.
사용자가 입력한 내용을 보기 쉽게 모은 것입니다.
```

화면에 보여줄 순서:

1. 방문 이유 후보
2. 위험 신호 안내가 있었는지
3. 사용자가 입력한 증상
4. 오늘 측정값
5. 저장된 기본 프로필과 의료정보
6. 첨부 파일
7. 원문 기록
8. 확인 필요 항목

### 수동 요약 항목 생성 예

사용자 입력:

```text
어제부터 어지럽고 속이 울렁거려요.
오늘 혈압은 150/90이에요.
```

수동 요약:

```json
{
  "title": "입력 내용 정리",
  "reasonForVisit": "어지러움, 속 울렁거림",
  "symptomTextItems": [
    {
      "label": "사용자 입력 증상",
      "value": "어제부터 어지럽고 속이 울렁거린다고 입력함",
      "source": "user_input"
    }
  ],
  "measurementItems": [
    {
      "label": "오늘 혈압",
      "value": "150/90",
      "source": "measurement"
    }
  ],
  "medicalInfoItems": [],
  "attachmentItems": [],
  "cautionText": "이 정리는 AI가 만든 요약이 아니며, 사용자가 입력한 내용을 보기 쉽게 모은 것입니다."
}
```

### 수동 요약과 AI 요약 차이

| 항목 | AI 요약 | 수동 요약 |
|---|---|---|
| 생성 방식 | MedGemma 사용 | 앱 규칙 사용 |
| 표시 이름 | AI 요약 | 입력 내용 정리 |
| S/O 분류 | 가능 | 억지로 하지 않음 |
| 진단/치료 추천 | 금지 | 금지 |
| AI 전송 동의 필요 | 필요 | 불필요 |
| AI 실패 시 사용 | 불가 | 가능 |

### 수동 요약 저장 규칙

- 로컬 저장 동의가 있으면 문진 기록에 저장한다.
- 로컬 저장 동의가 없으면 현재 화면에서만 보여준다.
- PDF 내보내기는 가능하다.
- PDF에는 “AI 요약 아님” 문구가 들어가야 한다.

### 수동 요약 구현 완료 기준

- AI 전송 동의가 없어도 수동 요약을 볼 수 있다.
- Hugging Face 실패 시 수동 요약을 볼 수 있다.
- 수동 요약은 “입력 내용 정리”로 표시된다.
- 수동 요약에는 사용자 원문이 포함된다.
- 수동 요약에는 사진/영상 첨부 목록이 포함된다.
- 수동 요약에는 진단명이나 치료 추천이 들어가지 않는다.
- 수동 요약 PDF에는 “AI 요약 아님” 문구가 들어간다.

## 9. 의료진용 요약 화면 정보 구조

의료진용 요약 화면은 진료실에서 바로 보여주는 화면이다.

목표:

- 의료진이 짧은 시간 안에 핵심을 볼 수 있게 한다.
- AI 요약과 수동 요약을 헷갈리지 않게 한다.
- 위험 신호와 확인 필요 항목을 놓치지 않게 한다.
- 원문과 첨부 파일을 바로 확인할 수 있게 한다.

### 화면 종류

의료진용 요약 화면은 두 종류가 있다.

| 종류 | 표시 이름 | 생성 방식 |
|---|---|---|
| AI 요약 | AI 요약 | MedGemma가 S/O 초안을 생성 |
| 수동 요약 | 입력 내용 정리 | 앱이 규칙 기반으로 입력 내용을 정리 |

공통 규칙:

- 둘 다 진단이 아니다.
- 둘 다 치료 방법을 추천하지 않는다.
- 둘 다 의료진 참고용이다.
- 첨부 사진과 영상은 의료진이 직접 확인해야 한다.

### AI 요약 화면 순서

AI 요약 화면은 아래 순서로 보여준다.

1. 상단 안내
2. 위험 신호 안내
3. 방문 이유
4. S: 사용자가 말한 증상
5. O: 사용자가 제공한 객관 참고 정보
6. 확인 필요 항목
7. 첨부 파일
8. 원문 기록
9. 생성 정보

상단 안내:

```text
AI 요약
의료진 참고용 초안입니다. 진단이나 치료 안내가 아닙니다.
```

위험 신호 안내:

- `safetyNotice`가 있으면 요약 상단 바로 아래에 보여준다.
- `urgent`이면 강하게 보여준다.
- 안내 문구는 “위험 신호가 있어요”를 사용한다.
- 병명이나 응급 확정 표현을 쓰지 않는다.

방문 이유:

- `reasonForVisit`을 보여준다.
- 없으면 “확인 필요”로 표시한다.

S 영역:

- 사용자가 직접 말한 증상과 경험을 보여준다.
- 시작 시점, 위치, 정도, 변화, 동반 증상을 포함한다.
- 사용자가 말하지 않은 내용을 추가하지 않는다.

O 영역:

- 사용자가 제공한 객관 참고 정보를 보여준다.
- 나이, 성별, 키, 몸무게, 복용약, 알레르기, 기존 질환, 가족력, 오늘 측정값, 첨부 파일 정보를 포함할 수 있다.
- 이 앱의 O는 의료진이 직접 확인한 객관 소견이 아니다.
- 그래서 O 영역 상단에 아래 안내를 작게 보여준다.

```text
O는 사용자가 제공한 참고 정보입니다. 의료진 확인이 필요합니다.
```

확인 필요 항목:

- `needsCheckItems`를 모아 보여준다.
- `needsCheck: true`인 S/O 항목도 여기서 다시 보여준다.
- 사진, 영상, 불확실한 측정값, 애매한 답변을 포함한다.

첨부 파일:

- 사진은 썸네일 또는 파일명으로 보여준다.
- 영상은 파일명과 첨부 여부만 보여준다.
- 사진과 영상 모두 “의료진 확인 필요”로 표시한다.

원문 기록:

- 사용자가 입력한 원문을 시간순으로 보여준다.
- 기본 화면에서는 접어둘 수 있다.
- 의료진이 원문을 확인할 수 있게 펼치기 기능을 제공한다.

생성 정보:

- 생성 시각
- AI 요약 여부
- AI 참고용 안내
- 사진 AI 전송 여부

### 수동 요약 화면 순서

수동 요약 화면은 아래 순서로 보여준다.

1. 상단 안내
2. 위험 신호 안내
3. 방문 이유 후보
4. 사용자가 입력한 증상
5. 오늘 측정값
6. 저장된 기본 프로필과 의료정보
7. 첨부 파일
8. 원문 기록
9. 확인 필요 항목

상단 안내:

```text
입력 내용 정리
AI가 만든 요약이 아닙니다. 사용자가 입력한 내용을 보기 쉽게 모은 것입니다.
```

수동 요약에서는 S/O 제목을 쓰지 않는다.  
앱이 S/O를 정확히 판단한 것처럼 보이면 안 되기 때문이다.

### 위험 신호 표시 규칙

위험 신호는 AI 요약과 수동 요약 모두에서 가장 위쪽에 보여준다.

표시 기준:

- `safetyNotice.level`이 `urgent`이면 빨리 눈에 띄게 보여준다.
- `safetyNotice.level`이 `caution`이면 주의 안내로 보여준다.
- 위험 신호가 없으면 영역을 숨긴다.

문구:

```text
위험 신호가 있었어요.
이 앱은 진단하지 않지만, 문진 중 도움 요청 안내가 표시되었습니다.
```

금지:

- “응급입니다”
- “심근경색 의심”
- “뇌졸중 가능성”
- “즉시 치료 필요”

### 확인 필요 항목 표시 규칙

확인 필요 항목은 의료진이 다시 물어봐야 할 수 있는 내용이다.

포함하는 것:

- 사용자가 `모르겠음`으로 답한 항목
- 값이 불완전한 측정값
- 사진/영상 첨부
- AI가 확실하지 않다고 표시한 항목
- 저장 정보가 오래됐거나 바뀔 수 있어 확인이 필요한 항목

표시 문구:

```text
확인 필요
아래 항목은 의료진 확인이 필요합니다.
```

### PDF 내보내기 구조

PDF는 화면과 같은 순서를 따른다.

PDF에 반드시 들어가는 것:

- 요약 종류: AI 요약 또는 입력 내용 정리
- 생성 시각
- 의료진 참고용 안내
- 위험 신호 안내가 있었는지
- 방문 이유
- S/O 또는 입력 내용 정리
- 확인 필요 항목
- 첨부 파일 목록
- 원문 기록

PDF 금지:

- 진단명
- 병명 추측
- 치료 추천
- AI가 사진을 판독한 것처럼 보이는 문구

### 구현 완료 기준

- AI 요약 화면과 수동 요약 화면이 명확히 구분된다.
- AI 요약 화면에는 `AI 요약`이라고 표시된다.
- 수동 요약 화면에는 `입력 내용 정리`라고 표시된다.
- 위험 신호가 있으면 요약 상단에 표시된다.
- 확인 필요 항목이 따로 모여 보인다.
- 첨부 파일 목록이 보인다.
- 원문 기록을 펼쳐 볼 수 있다.
- PDF 내보내기에도 같은 구조가 적용된다.

## 10. MedGemma에 보내는 정보

MedGemma에는 필요한 정보만 보낸다.

전제:

- AI 전송 동의가 있어야 한다.
- 사진은 사진 AI 전송 동의가 있어야 한다.
- 동의가 없으면 MedGemma API를 호출하지 않는다.

보내도 되는 정보:

- 나이
- 성별
- 키와 몸무게
- 기존 질환
- 복용약
- 알레르기
- 가족력
- 현재 증상
- 사용자가 입력한 문진 답변
- 압축된 사진

보내지 않는 정보:

- 이름
- 연락처
- 주민등록번호
- 주소
- 병원 회원번호
- 기기 안의 전체 기록
- 현재 문진과 관련 없는 과거 문진

사진 전송 규칙:

- 사진 AI 전송 동의가 있어야 한다.
- 사진은 사용자가 첨부했고 현재 문진에 관련 있을 때만 보낸다.
- 사진은 압축된 파일만 보낸다.
- 원본 사진은 보내지 않는다.
- 영상은 MedGemma에 보내지 않는다.

## 11. MedGemma 프롬프트 규칙

MedGemma의 원래 응답은 텍스트다.

MedGemma가 항상 JSON만 반환한다고 믿으면 안 된다.  
프롬프트로 JSON을 요청해도 앞뒤에 설명을 붙이거나, JSON 형식이 깨질 수 있다.

그래서 서버는 아래 순서로 처리한다.

1. MedGemma에 JSON 형식으로 답하라고 요청한다.
2. 응답 텍스트에서 JSON 부분을 찾는다.
3. JSON을 파싱한다.
4. 필요한 필드가 있는지 확인한다.
5. 금지 표현이 있는지 확인한다.
6. 실패하면 다시 시도하거나 `INVALID_AI_OUTPUT`으로 처리한다.

프롬프트는 아래 4개로 나눈다.

1. 공통 시스템 프롬프트
2. 질문 생성 프롬프트
3. S/O 요약 생성 프롬프트
4. 재시도 프롬프트

### 프롬프트 설계 원칙

MedGemma에게 모든 판단을 맡기지 않는다.

앱과 서버가 아래를 먼저 정한다.

- 현재 질문 수
- 이미 답한 정보
- 아직 비어 있는 문진 항목
- 저장된 기본 프로필
- 저장된 의료정보
- 이번 문진에만 저장할 측정값
- 의료정보에 계속 저장할 수 있는 후보

MedGemma는 이 정보를 보고 아래 중 하나만 한다.

- 다음 질문 1개 제안
- 위험 신호가 있으면 안전 안내 제안
- 요약 생성 가능하다고 알림
- S/O 요약 초안 생성

MedGemma가 하지 않는 일:

- 병명 추측
- 진단 가능성 말하기
- 치료 추천
- 약 복용 지시
- 사진 판독
- 로컬 저장소에 저장 지시
- 사용자 허락 없이 의료정보 저장 확정

프롬프트는 항상 아래 순서로 만든다.

```text
[공통 시스템 규칙]
[이번 작업 규칙]
[앱이 만든 현재 문진 상태 JSON]
[출력 JSON 스키마]
[나쁜 예 / 좋은 예]
```

### 공통 시스템 규칙

아래 규칙은 모든 AI 요청에 넣는다.

```text
너는 의료 문진을 돕는 보조 도구다.
너의 역할은 환자가 말한 정보를 의료진이 읽기 쉽게 정리하도록 돕는 것이다.
진단하지 않는다.
병명을 추측하지 않는다.
병명 후보를 사용자에게 말하지 않는다.
진단 가능성을 사용자에게 말하지 않는다.
치료 방법을 추천하지 않는다.
약 복용을 지시하지 않는다.
약 복용 중단을 지시하지 않는다.
응급 여부를 확정하지 않는다.
위험 신호가 보이면 진단 대신 도움 요청 안내를 제안한다.
위험 신호를 그냥 넘기지 않는다.
사진을 보고 병명을 말하지 않는다.
사진을 판독하지 않는다.
사용자가 제공하지 않은 사실을 만들지 않는다.
사용자가 제공한 정보만 정리한다.
모르는 내용은 확인 필요라고 표시한다.
답변은 반드시 요청한 JSON 형식으로만 한다.
JSON 앞뒤에 설명 문장을 붙이지 않는다.
마크다운 코드블록을 쓰지 않는다.
```

### 질문 생성 입력 데이터

질문 생성 API는 MedGemma에 아래 정보를 보낸다.

```json
{
  "task": "generate_next_question",
  "questionCount": 2,
  "maxCoreQuestions": 5,
  "profile": {
    "age": 74,
    "sex": "female",
    "medicalProfile": {
      "heightCm": 158,
      "weightKg": 55,
      "conditions": ["고혈압"],
      "medications": ["혈압약"],
      "allergies": [],
      "familyHistories": []
    }
  },
  "filledSlots": {
    "chiefComplaint": true,
    "onset": true,
    "location": false,
    "severity": false,
    "change": false,
    "triggers": false,
    "associatedSymptoms": false,
    "measurements": false,
    "medications": true,
    "allergies": false,
    "pastHistory": true
  },
  "messages": [
    {
      "role": "user",
      "text": "어제부터 어지럽고 속이 울렁거려요."
    }
  ],
  "measurements": [],
  "attachments": [],
  "missingMedicalProfileFields": ["allergies", "familyHistories"]
}
```

규칙:

- `filledSlots`는 앱이 계산한다.
- MedGemma는 `filledSlots`를 보고 가장 중요한 빈칸 1개를 고른다.
- `missingMedicalProfileFields`가 있어도 현재 문진에 필요할 때만 묻는다.
- 저장된 정보는 기본값으로 참고한다.
- 바뀔 수 있는 정보가 현재 증상과 관련 있으면 짧게 확인할 수 있다.
- 이미 이번 문진에서 답한 정보는 다시 묻지 않는다.

### 질문 생성 규칙

```text
목표:
의료진이 문진을 이해하는 데 필요한 정보를 짧게 확인한다.

규칙:
- 질문은 한 번에 하나만 한다.
- 저장된 정보는 기본값으로 참고한다.
- 바뀔 수 있는 정보이거나 현재 증상과 관련이 크면 확인할 수 있다.
- 이미 이번 문진에서 답한 정보는 다시 묻지 않는다.
- 중심 질문은 전체 4~5개 안에서 끝낸다.
- 체온, 혈압, 혈당은 필요할 때만 묻는다.
- 측정값을 바로 요구하지 말고 먼저 있는지 묻는다.
- 사용자가 모를 수 있는 정보는 건너뛸 수 있게 한다.
- 진단명, 병명, 치료 방법은 말하지 않는다.
- 병명 가능성을 말하지 않고 증상 확인 질문만 한다.
- 위험 신호가 보이면 진단하지 말고 안전 안내를 먼저 제안한다.
- 질문은 병명 기준이 아니라 증상, 시간, 위치, 정도, 변화, 동반 증상, 측정값 기준으로 한다.
```

질문 우선순위:

1. 주요 증상이 불명확하면 주요 증상을 묻는다.
2. 시작 시점이 없으면 언제부터인지 묻는다.
3. 위치가 필요한 증상인데 위치가 없으면 위치를 묻는다.
4. 정도가 없으면 불편한 정도를 묻는다.
5. 변화가 없으면 좋아지는지, 나빠지는지, 그대로인지 묻는다.
6. 유발/완화 상황이 중요하면 언제 심해지고 언제 나아지는지 묻는다.
7. 함께 나타난 증상이 중요하면 동반 증상을 묻는다.
8. 복용약, 알레르기, 기존 질환이 필요하고 저장되어 있지 않으면 묻는다.
9. 체온, 혈압, 혈당은 현재 증상에 도움이 될 때만 묻는다.

체온, 혈압, 혈당 질문 규칙:

- 값을 바로 묻지 않는다.
- 먼저 측정한 값이 있는지 묻는다.
- 선택지는 `예`, `아니오`, `모르겠음`을 쓸 수 있게 한다.
- 사용자가 `예`를 선택한 뒤 값을 입력한다.

좋은 질문 예:

```text
언제부터 어지러웠나요?
가만히 있어도 어지러운가요, 움직일 때 더 심한가요?
함께 나타난 증상이 있나요? 예: 두통, 구토, 숨참, 한쪽 팔다리 힘 빠짐
오늘 혈압이나 혈당을 잰 값이 있나요?
```

나쁜 질문 예:

```text
빈혈 가능성이 있어서 어지러운 건가요?
뇌졸중 증상일 수 있어서 한쪽 팔다리에 힘이 빠지나요?
골절일 수 있으니 사진을 더 올려주세요.
약을 드셨나요? 안 드셨으면 드세요.
```

질문 응답 JSON 스키마:

```json
{
  "action": "ask_next",
  "nextQuestion": {
    "id": "q_003",
    "text": "언제부터 불편했나요?",
    "answerType": "free_text",
    "target": "duration",
    "reason": "시작 시점이 아직 없어서 의료진 요약에 필요함"
  },
  "saveCandidates": [],
  "safetyNotice": null
}
```

허용되는 `action`:

- `ask_next`
- `show_safety_notice`
- `ready_for_summary`

허용되는 `answerType`:

- `free_text`
- `yes_no_unknown`
- `measurement`

허용되는 `target`:

- `chief_complaint`
- `duration`
- `location`
- `severity`
- `change`
- `trigger`
- `associated_symptoms`
- `medication`
- `allergy`
- `past_history`
- `family_history`
- `measurement`
- `attachment_context`

`reason` 규칙:

- 개발자와 서버 검증을 위한 값이다.
- 사용자에게 그대로 보여주지 않아도 된다.
- 병명이나 진단 가능성을 쓰면 안 된다.
- “시작 시점이 비어 있음”처럼 정보 부족 이유만 쓴다.

요약으로 넘어갈 때:

```json
{
  "action": "ready_for_summary",
  "nextQuestion": null,
  "saveCandidates": [],
  "safetyNotice": null
}
```

강한 위험 신호가 있을 때:

```json
{
  "action": "show_safety_notice",
  "nextQuestion": null,
  "saveCandidates": [],
  "safetyNotice": {
    "level": "urgent",
    "trigger": "chest_pain_with_breathing_or_sweat",
    "message": "위험 신호가 있어요. 이 앱은 진단하지 않지만, 지금은 문진보다 도움 요청이 먼저일 수 있어요. 주변 사람에게 알리거나 119에 연락하세요.",
    "actions": ["call_119", "show_to_nearby_person", "continue_interview"]
  }
}
```

안전 안내 문구 규칙:

- “응급입니다”라고 확정하지 않는다.
- “위험 신호가 있어요”라고 말한다.
- “문진보다 도움 요청이 먼저일 수 있어요”라고 안내한다.
- 119 또는 주변 사람에게 알리는 행동을 안내한다.
- 병명이나 진단 가능성을 말하지 않는다.

의료정보 장기 저장 후보가 있을 때:

```json
{
  "action": "ask_next",
  "nextQuestion": {
    "id": "q_004",
    "text": "복용 중인 약이 있나요?",
    "answerType": "free_text",
    "target": "medication",
    "reason": "복용약 정보가 저장되어 있지 않고 현재 문진에 참고될 수 있음"
  },
  "saveCandidates": [
    {
      "category": "medication",
      "value": "",
      "reason": "다음 문진에서 다시 묻지 않기 위해 저장 여부 확인 필요",
      "status": "pending"
    }
  ],
  "safetyNotice": null
}
```

주의:

- `saveCandidates.value`는 사용자가 실제로 답한 뒤 채운다.
- MedGemma가 빈 값으로 후보 카테고리만 알려줄 수 있다.
- 앱은 사용자 답변 뒤 저장 여부를 물어본다.

### 질문 생성 프롬프트 예시

```text
너는 의료 문진을 돕는 보조 도구다.
진단하지 않는다.
병명을 추측하지 않는다.
병명 후보를 사용자에게 말하지 않는다.
진단 가능성을 사용자에게 말하지 않는다.
치료 방법을 추천하지 않는다.
약 복용을 지시하지 않는다.
응급 여부를 확정하지 않는다.
위험 신호가 보이면 진단하지 말고 안전 안내를 먼저 제안한다.
위험 신호를 그냥 넘기지 않는다.
사용자가 제공한 정보만 사용한다.

작업:
현재 문진 상태를 보고 다음 질문 1개를 만든다.
질문이 더 필요 없으면 ready_for_summary를 반환한다.

질문 규칙:
- 한 번에 질문 1개만 한다.
- 이미 이번 문진에서 답한 정보는 다시 묻지 않는다.
- 저장된 의료정보는 기본값으로 참고한다.
- 복용약, 알레르기, 몸무게처럼 바뀔 수 있는 정보는 현재 증상과 관련 있으면 짧게 확인할 수 있다.
- 전체 중심 질문은 5개를 넘기지 않는다.
- 병명, 진단 가능성, 치료 방법을 말하지 않는다.
- 위험 신호가 보이면 show_safety_notice를 반환한다.
- show_safety_notice는 진단이 아니라 도움 요청 안내다.
- 질문은 증상, 시간, 위치, 정도, 변화, 동반 증상, 측정값 기준으로 한다.
- 체온, 혈압, 혈당은 필요할 때만 묻고, 먼저 측정값이 있는지 묻는다.

현재 문진 상태:
{{INTERVIEW_CONTEXT_JSON}}

반드시 아래 JSON 형식으로만 답한다:
{{QUESTION_OUTPUT_SCHEMA}}
```

### 요약 생성 규칙

```text
목표:
의료진이 바로 볼 수 있는 S/O 요약 초안을 만든다.

S에는 사용자가 직접 말한 증상과 경험을 넣는다.
O에는 사용자가 제공한 객관 참고 정보를 넣는다.

금지:
- 진단명
- 병명 추측
- 치료 추천
- 약 복용 지시
- 사진 판독
- 응급 확정
```

S/O 분류 규칙:

S에 넣는 것:

- 사용자가 직접 말한 증상
- 통증, 불편감, 어지러움 같은 느낌
- 시작 시점
- 증상 변화
- 좋아지거나 나빠지는 상황
- 동반 증상
- 사용자가 말한 걱정이나 불편

O에 넣는 것:

- 나이, 성별
- 키, 몸무게
- 복용약
- 알레르기
- 기존 질환
- 가족력
- 오늘 잰 체온
- 오늘 잰 혈압
- 오늘 잰 혈당
- 첨부한 사진
- 첨부한 영상 파일

O 주의:

- 이 앱의 O는 의료진이 직접 확인한 객관 소견이 아니다.
- “사용자가 제공한 객관 참고 정보”라고 본다.
- 사진은 “첨부됨, 의료진 확인 필요”까지만 쓴다.
- 사진을 해석하거나 병명을 말하지 않는다.

요약 응답 JSON 스키마:

```json
{
  "reasonForVisit": "팔꿈치 통증",
  "subjective": [
    {
      "label": "주요 증상",
      "value": "사용자는 팔꿈치 통증을 호소함",
      "needsCheck": false
    }
  ],
  "objective": [
    {
      "label": "첨부 자료",
      "value": "팔꿈치 사진 1장이 첨부됨. 의료진 확인 필요",
      "needsCheck": true
    }
  ],
  "cautionText": "AI 요약은 의료진 참고용 초안입니다."
}
```

요약 작성 문체:

- 짧고 명확하게 쓴다.
- 추측하지 않는다.
- 사용자가 말한 사실과 저장된 정보만 쓴다.
- 불확실하면 “확인 필요”라고 쓴다.
- “~로 보임”, “~가능성”, “~의심” 같은 표현을 쓰지 않는다.

요약 생성 프롬프트 예시:

```text
너는 의료 문진을 돕는 보조 도구다.
진단하지 않는다.
병명을 추측하지 않는다.
진단 가능성을 말하지 않는다.
치료 방법을 추천하지 않는다.
사진을 판독하지 않는다.

작업:
아래 문진 기록을 의료진이 볼 수 있는 S/O 요약 초안으로 정리한다.

S에는 사용자가 직접 말한 증상과 경험을 넣는다.
O에는 사용자가 제공한 객관 참고 정보를 넣는다.

주의:
이 앱의 O는 의료진이 직접 확인한 객관 소견이 아니다.
사용자가 제공한 객관 참고 정보다.

금지 표현:
- 진단됩니다
- 가능성이 높습니다
- 의심됩니다
- 감염으로 보입니다
- 골절일 수 있습니다
- 약을 드세요
- 복용을 중단하세요
- 응급입니다

문진 기록:
{{INTERVIEW_RECORD_JSON}}

반드시 아래 JSON 형식으로만 답한다:
{{SUMMARY_OUTPUT_SCHEMA}}
```

### 재시도 프롬프트

MedGemma 응답이 깨졌을 때 서버는 한 번만 재시도할 수 있다.

재시도 조건:

- JSON 파싱 실패
- JSON 앞뒤에 설명 문장 포함
- 필수 필드 누락
- 질문이 2개 이상 포함
- 병명 후보 포함
- 진단 가능성 포함
- 치료 추천 포함

재시도 프롬프트:

```text
이전 응답은 사용할 수 없다.
이유:
{{VALIDATION_ERROR_REASON}}

다시 답한다.
반드시 JSON만 출력한다.
JSON 앞뒤에 설명을 붙이지 않는다.
마크다운 코드블록을 쓰지 않는다.
진단명, 병명 후보, 진단 가능성, 치료 추천을 쓰지 않는다.

원래 작업:
{{ORIGINAL_TASK_PROMPT}}
```

재시도도 실패하면:

- 질문 생성은 `INVALID_AI_OUTPUT`으로 실패 처리한다.
- 요약 생성은 `INVALID_AI_OUTPUT`으로 실패 처리한다.
- 사용자는 다시 시도하거나 수동 요약을 볼 수 있다.

## 12. AI 응답 검증

서버는 MedGemma 응답을 그대로 믿지 않는다.

검증은 4단계로 한다.

### 1단계: JSON 추출

MedGemma 응답은 텍스트일 수 있다.

처리:

1. 응답에서 첫 번째 `{`와 마지막 `}` 사이를 찾는다.
2. 그 부분을 JSON 후보로 본다.
3. JSON 후보가 없으면 실패 처리한다.
4. JSON 파싱에 실패하면 재시도한다.

주의:

- 마크다운 코드블록은 제거한다.
- JSON 앞뒤 설명 문장은 버린다.
- JSON이 2개 이상이면 실패 처리한다.

### 2단계: 스키마 검증

검증해야 하는 것:

- JSON으로 파싱되는가
- 필요한 필드가 있는가
- `action` 값이 허용된 값인가
- 질문이 한 번에 하나인가
- `answerType` 값이 허용된 값인가
- `target` 값이 허용된 값인가
- `saveCandidates`가 배열인가
- `safetyNotice`가 있으면 허용된 형식인가
- 금지어가 들어갔는가
- 진단명처럼 보이는 표현이 들어갔는가
- 치료 추천 문장이 들어갔는가

질문 응답 필수 필드:

- `action`
- `nextQuestion`
- `saveCandidates`
- `safetyNotice`

`action`이 `ask_next`이면 필요한 필드:

- `nextQuestion.id`
- `nextQuestion.text`
- `nextQuestion.answerType`
- `nextQuestion.target`
- `nextQuestion.reason`

`action`이 `ready_for_summary`이면:

- `nextQuestion`은 `null`이어야 한다.

`action`이 `show_safety_notice`이면:

- `nextQuestion`은 `null`이어야 한다.
- `safetyNotice`가 있어야 한다.
- `safetyNotice.level`은 `caution` 또는 `urgent`여야 한다.
- `safetyNotice.message`에는 진단명이 없어야 한다.
- `safetyNotice.actions`에는 허용된 행동만 들어가야 한다.

요약 응답 필수 필드:

- `reasonForVisit`
- `subjective`
- `objective`
- `cautionText`

### 3단계: 안전 문장 검증

금지 표현 예:

- “진단됩니다”
- “가능성이 높습니다”
- “가능성이 있습니다”
- “의심됩니다”
- “의심돼요”
- “감염으로 보입니다”
- “골절일 수 있습니다”
- “뇌졸중일 수 있습니다”
- “당뇨일 수 있습니다”
- “약을 드세요”
- “복용을 중단하세요”
- “병원에 가지 않아도 됩니다”
- “응급입니다”

금지 표현 처리:

- 질문 응답에 금지 표현이 있으면 재시도한다.
- 요약 응답에 금지 표현이 있으면 해당 문장을 제거한다.
- 제거하면 의미가 깨지는 경우 실패 처리한다.
- 재시도 후에도 금지 표현이 있으면 `INVALID_AI_OUTPUT`으로 처리한다.

허용되는 표현:

- “확인 필요”
- “의료진 확인 필요”
- “위험 신호가 있어요”
- “지금은 문진보다 도움 요청이 먼저일 수 있어요”
- “주변 사람에게 알리거나 119에 연락하세요”
- “증상이 심하거나 계속되면 주변 사람이나 의료진에게 알려주세요”
- “첨부 사진은 의료진 확인 필요”

### 4단계: 질문 품질 검증

질문 응답은 아래 기준을 통과해야 한다.

- 질문은 1개만 있어야 한다.
- 질문 문장은 너무 길지 않아야 한다.
- 질문 안에 병명 후보가 없어야 한다.
- 질문 안에 진단 가능성이 없어야 한다.
- 질문 안에 치료 지시가 없어야 한다.
- 강한 위험 신호가 있는데 일반 질문만 반환하면 안 된다.
- 강한 위험 신호가 있으면 `show_safety_notice`를 우선한다.
- 이미 이번 문진에서 답한 정보를 다시 묻지 않아야 한다.
- 저장된 의료정보를 이유 없이 반복해서 묻지 않아야 한다.
- 복용약, 알레르기, 몸무게처럼 바뀔 수 있는 정보는 현재 증상과 관련이 크면 짧게 확인할 수 있다.
- `questionCount`가 5 이상이면 `ready_for_summary`가 우선이다.

질문이 2개 이상이면:

- 서버가 안전하게 1개로 줄일 수 있으면 첫 질문만 사용한다.
- 줄이면 의미가 이상해지면 재시도한다.

이미 답한 정보를 다시 물으면:

- 재시도한다.
- 재시도 후에도 반복하면 `INVALID_AI_OUTPUT`으로 처리한다.

처리:

- 금지 표현이 있으면 해당 문장을 제거한다.
- 제거 후 의미가 이상하면 `INVALID_AI_OUTPUT`으로 실패 처리한다.
- 실패하면 사용자는 다시 시도하거나 수동 요약을 볼 수 있다.

## 13. 입력 방식과 첨부 파일 처리 상세

이 앱은 사용자가 편한 방식으로 증상을 남기는 것이 중요하다.  
그래서 글, 음성, 사진, 영상을 모두 받을 수 있어야 한다.

공통 목표:

- 사용자가 입력한 원문을 최대한 보존한다.
- AI에 보내는 정보와 로컬에만 저장하는 정보를 구분한다.
- 사용자가 실수로 첨부한 파일을 지울 수 있게 한다.
- 첨부 실패가 문진 실패로 이어지지 않게 한다.

### 글 입력

글 입력은 가장 기본 입력 방식이다.

처리 순서:

1. 사용자가 증상이나 답변을 입력한다.
2. 빈 문장인지 확인한다.
3. 앞뒤 공백을 정리한다.
4. 문진 메시지로 저장한다.
5. AI 전송 동의가 있으면 다음 질문 생성에 사용한다.

규칙:

- 사용자가 쓴 표현을 앱이 고치지 않는다.
- 맞춤법을 자동으로 고치지 않는다.
- 의료 용어로 바꿔 쓰지 않는다.
- 너무 긴 문장은 저장하되, AI 요청에서는 길이를 줄여 보낼 수 있다.
- 길이를 줄일 때도 의미를 바꾸면 안 된다.

권장 제한:

- 한 번 입력은 2,000자 이하를 권장한다.
- 2,000자를 넘으면 저장은 하되, AI에는 최근 핵심 문장 중심으로 보낸다.
- 사용자가 보기에는 원문 전체가 남아 있어야 한다.

### 선택 입력

선택 입력은 큰 버튼으로 빠르게 답할 수 있는 입력 방식이다.

사용 예:

- `예`
- `아니오`
- `모르겠음`
- 통증 정도
- 증상 위치
- 증상 시작 시점

규칙:

- 선택 입력도 문진 메시지로 저장한다.
- `예`, `아니오`, `모르겠음`은 `choiceValue`로 저장한다.
- `모르겠음`은 틀린 답이 아니다.
- `모르겠음`으로 답한 항목은 의료진용 요약의 확인 필요 항목에 들어갈 수 있다.

### 첨부 공통 규칙

사진과 영상은 문진 기록에 연결된 첨부 파일이다.

공통 처리 순서:

1. 사용자가 파일을 선택한다.
2. 앱이 파일 형식과 크기를 확인한다.
3. 허용 가능한 파일이면 IndexedDB `blobs`에 저장한다.
4. 파일 정보는 IndexedDB `attachments`에 저장한다.
5. 문진 메시지에는 첨부 파일 id만 연결한다.
6. 사용자가 삭제하면 `attachments`와 `blobs`에서 함께 삭제한다.

공통 규칙:

- 첨부 파일은 자동으로 AI에 보내지 않는다.
- 사진 AI 전송 동의가 있어야 사진을 AI에 보낼 수 있다.
- 영상은 AI에 보내지 않는다.
- 첨부 파일은 의료진용 요약에 목록으로 표시한다.
- 사진과 영상에는 “의료진 확인 필요” 표시를 붙인다.
- 첨부 실패가 있어도 글이나 음성 문진은 계속할 수 있어야 한다.

권장 제한:

- 사진은 한 문진에 최대 3장까지 허용한다.
- 영상은 한 문진에 최대 1개까지 허용한다.
- 영상은 50MB 이하만 허용한다.

### 사진 처리

사진 처리 순서:

1. 사용자가 사진을 선택한다.
2. 브라우저가 이미지 크기를 확인한다.
3. 긴 쪽 길이가 1024px보다 크면 줄인다.
4. JPEG 같은 가벼운 형식으로 바꾼다.
5. 압축된 Blob을 IndexedDB `blobs`에 저장한다.
6. 파일 정보는 `attachments`에 저장한다.
7. 문진 메시지에는 첨부 id만 연결한다.

저장 규칙:

- 원본 사진은 저장하지 않는다.
- 압축한 사진만 저장한다.
- 사진 미리보기가 필요하면 작은 썸네일을 따로 만든다.
- 사진의 EXIF 위치 정보는 저장하지 않는 것을 원칙으로 한다.
- 압축 후 목표 크기는 장당 2MB 이하로 둔다.

AI 전송 규칙:

- 사진 AI 전송 동의가 없으면 사진을 MedGemma로 보내지 않는다.
- 사진 AI 전송 동의가 있어도 첫 전송 전에는 한 번 더 확인한다.
- AI로 보낸 사진은 `aiTransferStatus: "sent"`로 표시한다.
- 전송 실패 시 `aiTransferStatus: "failed"`로 표시한다.
- 사진을 AI에 보내지 않아도 의료진용 요약에는 첨부 목록이 남는다.

실패 처리:

- 이미지 파일이 아니면 첨부 실패로 처리한다.
- 압축에 실패하면 사용자에게 다시 시도할 수 있게 한다.
- 저장 공간이 부족하면 삭제 안내를 보여준다.
- 사진이 3장을 넘으면 더 이상 첨부할 수 없다고 안내한다.

### 영상 처리

영상 처리 순서:

1. 사용자가 영상을 선택한다.
2. 파일 이름, 형식, 크기를 확인한다.
3. Blob을 IndexedDB `blobs`에 저장한다.
4. 파일 정보는 `attachments`에 저장한다.
5. 요약에는 “영상 첨부 있음”으로만 표시한다.

규칙:

- 영상은 AI에 보내지 않는다.
- 영상에서 내용을 분석하지 않는다.
- 영상 파일이 너무 크면 첨부 실패로 처리할 수 있다.
- 영상은 원본 파일을 그대로 저장한다.
- 영상 미리보기는 필수가 아니다.
- 요약에는 파일명, 크기, 첨부 시각만 표시한다.
- 의료진이 직접 영상을 열어 확인할 수 있게 한다.

권장 제한:

- 데모에서는 영상 1개당 최대 50MB까지 허용한다.
- 한 문진에 영상은 최대 1개만 허용한다.
- 저장 공간 부족 가능성을 사용자에게 알려준다.

### 음성 입력 처리

브라우저 음성 인식을 우선 사용한다.

처리 순서:

1. 사용자가 말하기 버튼을 누른다.
2. 앱이 듣는 중 상태를 보여준다.
3. 말소리가 들어오면 텍스트 변환을 시작한다.
4. 3.5초 이상 말소리가 없으면 말하기 종료로 본다.
5. 변환된 문장을 사용자에게 보여준다.
6. 사용자가 문장을 고칠 수 있다.
7. 사용자가 확인하면 문진 답변으로 저장한다.

규칙:

- 음성 인식 결과는 자동 제출하지 않는다.
- 사용자가 확인해야 제출한다.
- 음성 인식이 실패하면 글 입력으로 바꿀 수 있어야 한다.
- 음성 원본 파일은 저장하지 않는다.
- 저장하는 것은 사용자가 확인한 텍스트다.
- 브라우저가 음성 인식을 지원하지 않으면 말하기 버튼을 숨기거나 비활성화한다.
- 마이크 권한을 거부해도 글 입력과 사진/영상 첨부는 계속 사용할 수 있어야 한다.
- 사용자가 고친 최종 문장만 AI에 보낸다.

음성 인식 실패 문구:

```text
음성을 글로 바꾸지 못했어요.
직접 글로 입력해 주세요.
```

## 14. 잠금 설정

회원가입은 만들지 않는다.

잠금 설정은 선택 기능이다.

잠금 설정의 목표:

- 같은 컴퓨터를 잠깐 다른 사람이 볼 때 기록이 바로 보이지 않게 한다.
- 회원가입 없이 간단히 켜고 끌 수 있게 한다.
- PIN 원문을 저장하지 않는다.
- PIN을 모르면 앱 안 기록을 쉽게 열 수 없게 한다.

잠금 설정이 아닌 것:

- 서버 계정 보안이 아니다.
- 의료정보를 완전히 암호화하는 기능이 아니다.
- 브라우저 개발자 도구나 기기 접근 권한까지 막는 기능이 아니다.
- PIN 복구 기능을 제공하지 않는다.

### 1차 데모 범위

1차 데모에서는 **4자리 PIN 잠금만 실제 구현**한다.

포함:

- 4자리 PIN
- PIN 확인
- PIN 변경
- PIN 해제
- 앱 처음 열 때 잠금 화면 표시
- 일정 시간 사용하지 않으면 다시 잠금

제외:

- Face ID
- Touch ID
- SMS 인증
- 이메일 인증
- PIN 찾기

Face ID/Touch ID는 추후 iOS Native에서 검토한다.

### 잠금 상태

잠금 상태는 아래처럼 나눈다.

| 상태 | 의미 |
|---|---|
| `off` | 잠금이 꺼져 있음 |
| `setup_required` | 사용자가 잠금을 켜려 했지만 PIN 설정 전 |
| `locked` | 앱 기록을 볼 수 없음 |
| `unlocked` | 앱 기록을 볼 수 있음 |
| `temporarily_blocked` | PIN 실패가 많아 잠시 막힘 |

앱 시작 시 처리:

1. `settings.lock.enabled`를 확인한다.
2. 잠금이 꺼져 있으면 홈 화면으로 간다.
3. 잠금이 켜져 있으면 잠금 화면을 먼저 보여준다.
4. PIN이 맞으면 `lastUnlockedAt`을 저장하고 홈 화면으로 간다.

### PIN 설정

PIN 설정 순서:

1. 사용자가 설정 화면에서 `잠금 켜기`를 누른다.
2. 4자리 숫자 PIN을 입력한다.
3. 같은 PIN을 한 번 더 입력한다.
4. 두 입력이 같으면 PIN을 해시로 바꿔 저장한다.
5. 잠금이 켜졌다는 안내를 보여준다.

규칙:

- PIN은 숫자 4자리만 허용한다.
- `0000`, `1111`, `1234`처럼 너무 쉬운 PIN은 막는다.
- PIN 입력 화면의 버튼은 48px 이상으로 만든다.
- PIN 입력 실패 문구는 짧게 보여준다.

문구:

```text
PIN이 맞지 않아요.
다시 입력해 주세요.
```

### PIN 검증

PIN 검증 순서:

1. 사용자가 PIN을 입력한다.
2. 저장된 `pinSalt`를 가져온다.
3. 입력한 PIN과 salt로 해시를 만든다.
4. 저장된 `pinHash`와 비교한다.
5. 맞으면 잠금을 푼다.
6. 틀리면 `failedAttempts`를 1 늘린다.

실패 제한:

- 5번 연속 실패하면 1분 동안 다시 입력하지 못하게 한다.
- 막힌 시간은 `lockedUntil`에 저장한다.
- 시간이 지나면 다시 입력할 수 있다.

주의:

- PIN 비교는 서버에서 하지 않는다.
- PIN은 현재 브라우저 안에서만 의미가 있다.
- 브라우저 데이터를 삭제하면 PIN 설정도 사라질 수 있다.

### PIN 변경

PIN 변경 순서:

1. 기존 PIN을 입력한다.
2. 맞으면 새 PIN을 입력한다.
3. 새 PIN을 한 번 더 입력한다.
4. 새 PIN 해시와 salt를 저장한다.
5. `failedAttempts`를 0으로 초기화한다.

기존 PIN을 모르면 변경할 수 없다.

### PIN 해제

PIN 해제 순서:

1. 사용자가 `잠금 끄기`를 누른다.
2. 기존 PIN을 입력한다.
3. 맞으면 `enabled`를 `false`로 바꾼다.
4. `pinHash`, `pinSalt`, `failedAttempts`, `lockedUntil`을 비운다.

### 자동 잠금

자동 잠금은 사용자가 앱을 열어 둔 채 자리를 비울 때 필요하다.

1차 데모 기준:

- 마지막 조작 후 10분이 지나면 다시 잠근다.
- 브라우저 탭을 닫았다가 다시 열면 잠금 화면을 보여준다.
- 문진 작성 중 자동 잠금이 걸려도 작성 중인 기록은 지우지 않는다.

### PIN 분실

PIN 복구는 제공하지 않는다.

사용자 안내:

```text
PIN을 잊어버리면 기록을 열 수 없어요.
PIN을 새로 만들려면 이 브라우저의 앱 데이터를 초기화해야 해요.
```

데모에서는 설정 화면에 `앱 데이터 초기화` 위치만 둔다.  
실제 초기화는 사용자가 다시 확인한 뒤 실행해야 한다.

### iOS Native 전환 기준

나중에 iOS Native로 옮길 때는 아래 기준으로 바꾼다.

- PIN 해시와 민감 설정은 Keychain에 저장한다.
- Face ID/Touch ID를 우선 제공한다.
- 생체 인증 실패 시 PIN fallback을 제공한다.
- 의료정보와 문진 기록 암호화 여부를 별도로 검토한다.

저장 규칙:

- PIN 원문은 저장하지 않는다.
- PIN은 해시로 바꿔 IndexedDB `settings`에 저장한다.
- 잠금 설정은 이 기기에서만 적용된다.

## 15. 오류 처리

오류 처리는 사용자가 문진을 포기하지 않게 만드는 장치다.

공통 원칙:

- 오류 문구는 짧고 쉬워야 한다.
- 원인을 자세히 몰라도 사용자가 다음 행동을 알 수 있어야 한다.
- 의료정보, 문진 본문, 사진은 오류 로그에 남기지 않는다.
- AI가 실패해도 수동 문진과 수동 요약으로 이어갈 수 있어야 한다.
- 첨부가 실패해도 글 입력 문진은 계속할 수 있어야 한다.

공통 오류 응답:

```ts
type ClientErrorView = {
  title: string;
  message: string;
  primaryAction: ErrorAction;
  secondaryAction?: ErrorAction;
  canContinueInterview: boolean;
};

type ErrorAction =
  | "retry"
  | "continue_without_ai"
  | "show_manual_summary"
  | "open_settings"
  | "remove_attachment"
  | "use_text_input"
  | "go_home";
```

표시 방식:

- 문진을 계속할 수 있으면 화면 전체를 막지 않는다.
- 중요한 오류만 전체 화면으로 보여준다.
- 버튼은 최소 48px 이상으로 만든다.
- 같은 오류가 반복되면 수동 요약 버튼을 더 눈에 띄게 보여준다.

### Hugging Face 무료 사용량 초과

조건:

- 429 응답
- rate limit 관련 오류

처리:

- `HF_RATE_LIMIT`으로 응답한다.
- `retryable`은 `true`로 둔다.
- `canUseManualSummary`는 `true`로 둔다.
- 사용자는 다시 시도할 수 있다.
- 수동 요약 보기 버튼을 제공한다.

문구:

```text
AI 사용량이 잠시 많아요.
다시 시도하거나 입력 내용 정리로 볼 수 있어요.
```

### 모델 로딩 중

조건:

- Hugging Face가 모델 로딩 중이라고 응답

처리:

- `HF_MODEL_LOADING`으로 응답한다.
- `retryable`은 `true`로 둔다.
- `canUseManualSummary`는 `true`로 둔다.
- 잠시 후 다시 시도 안내를 보여준다.

문구:

```text
AI가 준비 중이에요.
잠시 후 다시 시도해 주세요.
```

### Hugging Face 연결 실패

조건:

- Hugging Face 서버 오류
- 요청 시간 초과
- 네트워크 연결 실패

처리:

- `HF_UNAVAILABLE` 또는 `NETWORK_ERROR`로 응답한다.
- `retryable`은 `true`로 둔다.
- `canUseManualSummary`는 `true`로 둔다.
- Hugging Face 응답 대기 시간은 30초로 둔다.
- 사용자가 문진 내용을 잃지 않게 현재 기록을 먼저 저장한다.

문구:

```text
AI와 연결하지 못했어요.
작성한 내용은 남아 있어요.
```

### AI 응답 형식 오류

조건:

- JSON 파싱 실패
- 필요한 필드 없음
- 금지 표현 포함

처리:

- `INVALID_AI_OUTPUT`으로 응답한다.
- 다시 시도 버튼을 제공한다.
- 수동 요약 보기 버튼을 제공한다.
- 같은 문진에서 2번 연속 실패하면 수동 요약을 더 크게 보여준다.

문구:

```text
AI 답변을 정리하지 못했어요.
다시 시도하거나 입력 내용 정리로 볼 수 있어요.
```

### AI 전송 동의 없음

조건:

- 사용자가 AI 전송에 동의하지 않음
- 동의 버전이 바뀌어 다시 동의가 필요함

처리:

- `AI_CONSENT_REQUIRED`로 처리한다.
- MedGemma API를 호출하지 않는다.
- 사용자는 동의 화면으로 갈 수 있다.
- 동의하지 않아도 수동 문진과 수동 요약은 가능하다.

문구:

```text
AI 기능을 쓰려면 전송 동의가 필요해요.
동의하지 않아도 입력 내용 정리는 볼 수 있어요.
```

### 사진 AI 전송 동의 없음

조건:

- 사진을 AI에 보내려 하지만 사진 AI 전송 동의가 없음

처리:

- `PHOTO_AI_CONSENT_REQUIRED`로 처리한다.
- 사진은 MedGemma로 보내지 않는다.
- 사진은 첨부 파일로만 저장한다.
- 문진은 계속한다.

문구:

```text
사진은 AI에 보내지 않았어요.
첨부 파일로만 저장돼요.
```

### 음성 입력 오류

조건:

- 마이크 권한 거부
- 브라우저가 음성 인식을 지원하지 않음
- 음성을 글로 바꾸지 못함

처리:

- 권한 거부는 `MIC_PERMISSION_DENIED`로 처리한다.
- 미지원은 `SPEECH_NOT_SUPPORTED`로 처리한다.
- 글 입력으로 전환하는 버튼을 보여준다.
- 문진은 계속한다.

문구:

```text
음성 입력을 사용할 수 없어요.
글로 입력해 주세요.
```

### 첨부 파일 오류

조건:

- 파일이 너무 큼
- 지원하지 않는 파일 형식
- 사진 3장 초과
- 영상 1개 초과
- 영상 50MB 초과

처리:

- 파일 크기 초과는 `FILE_TOO_LARGE`로 처리한다.
- 지원하지 않는 형식은 `UNSUPPORTED_FILE_TYPE`으로 처리한다.
- 개수 초과는 `TOO_MANY_ATTACHMENTS`로 처리한다.
- 첨부만 실패시키고 문진은 계속한다.

문구:

```text
이 파일은 첨부할 수 없어요.
다른 파일을 선택해 주세요.
```

### 저장 실패

조건:

- IndexedDB 오류
- 저장 공간 부족
- Blob 저장 실패

처리:

- 사용자가 다시 시도할 수 있게 한다.
- 첨부 파일을 줄이거나 삭제할 수 있게 안내한다.
- 저장 공간 부족은 `STORAGE_QUOTA_EXCEEDED`로 처리한다.
- IndexedDB 사용 불가는 `INDEXEDDB_UNAVAILABLE`로 처리한다.
- 문진 본문이 메모리에 남아 있으면 사용자가 복사하거나 PDF로 내보낼 수 있게 한다.

문구:

```text
기기에 저장하지 못했어요.
첨부 파일을 줄이거나 다시 시도해 주세요.
```

### 잠금 오류

조건:

- PIN이 맞지 않음
- PIN을 5번 연속 틀림
- 잠금 설정 저장 실패

처리:

- PIN 불일치는 화면에 짧게 표시한다.
- 5번 연속 실패하면 1분 동안 입력을 막는다.
- 잠금 설정 저장 실패는 `LOCK_FAILED`로 처리한다.
- 잠금 실패 때문에 문진 기록을 삭제하지 않는다.

문구:

```text
PIN이 맞지 않아요.
다시 입력해 주세요.
```

### 오류 로그

남기는 정보:

- 오류 코드
- 발생 시각
- 화면 이름
- 재시도 횟수

남기지 않는 정보:

- 이름
- 연락처
- 문진 본문
- 사진/영상 파일
- 의료정보

### 오류 처리 완료 기준

- AI 실패 시 수동 요약으로 갈 수 있다.
- 첨부 실패 시 문진을 계속할 수 있다.
- 음성 실패 시 글 입력으로 바꿀 수 있다.
- 저장 실패 시 사용자가 다시 시도하거나 첨부를 줄일 수 있다.
- 오류 로그에 민감한 내용이 남지 않는다.

## 16. 구현 파일 구조

Next.js 프로젝트를 만들면 아래 구조를 권장한다.

```text
app/
  api/
    ai/
      question/route.ts
      summary/route.ts
      manual-summary/route.ts
  interview/
    new/page.tsx
  records/
    page.tsx
    [id]/page.tsx
  profile/
    page.tsx
    medical/page.tsx
  settings/
    page.tsx
    lock/page.tsx
lib/
  ai/
    hfClient.ts
    prompts.ts
    validators.ts
  interview/
    inputRules.ts
    interviewState.ts
    summaryRules.ts
    manualSummaryRules.ts
  storage/
    db.ts
    repositories.ts
  media/
    fileValidation.ts
    compressImage.ts
    attachmentStore.ts
  voice/
    speechRecognition.ts
  lock/
    pinLock.ts
    pinHash.ts
  errors/
    errorMessages.ts
    errorMapper.ts
types/
  errors.ts
  interview.ts
  profile.ts
  settings.ts
  summary.ts
```

역할:

- `lib/storage`: IndexedDB 읽기/쓰기
- `lib/ai`: Hugging Face 호출, 프롬프트, 응답 검증
- `lib/interview`: 문진 상태 흐름, 입력 규칙, 수동 요약 생성 규칙
- `lib/media`: 파일 검증, 사진 압축, 첨부 저장
- `lib/voice`: 음성 입력 처리
- `lib/lock`: PIN 설정, 검증, 자동 잠금 처리
- `lib/errors`: 오류 코드를 사용자 문구와 다음 행동으로 바꾸는 규칙
- `types`: 공통 타입

## 17. 환경 변수

필요한 환경 변수:

```text
HUGGINGFACE_API_TOKEN=
HUGGINGFACE_MODEL_ID=google/medgemma-1.5-4b-it
```

규칙:

- `.env.local`에 저장한다.
- 브라우저에서 접근 가능한 `NEXT_PUBLIC_` 이름을 쓰지 않는다.
- 토큰이 없으면 AI API는 실패 응답을 준다.
- 토큰이 없어도 수동 요약은 동작해야 한다.

## 18. 구현 완료 기준

아래가 되면 1차 데모 구현 완료로 본다.

### 저장

- 기본 프로필이 저장된다.
- 생년월일이 있으면 나이를 만 나이로 계산한다.
- 사용자가 나이만 직접 입력하면 입력 날짜가 함께 저장된다.
- 키와 몸무게가 의료정보에 저장된다.
- 문진 기록이 저장된다.
- 체온, 혈압, 혈당은 문진 기록에만 저장된다.
- 오늘 증상, 오늘 측정값, 오늘 첨부 파일은 저장 여부를 다시 묻지 않고 문진 기록에 저장된다.
- 복용약, 알레르기, 기존 질환처럼 계속 참고할 의료정보만 저장 여부를 묻는다.
- 특정 문진을 삭제하면 연결된 첨부 파일도 삭제된다.
- 의료진용 요약을 PDF로 내보낼 수 있다.
- 문진 기록을 JSON 백업 파일로 내보낼 수 있다.
- JSON 백업 파일을 다시 가져올 수 있다.
- 현재 웹 프로토타입 저장은 브라우저 IndexedDB 기반임을 사용자에게 안내한다.

### 문진

- 사용자가 글로 증상을 입력할 수 있다.
- 글 입력은 사용자가 쓴 표현을 바꾸지 않고 저장된다.
- 사용자가 음성으로 입력하고 결과를 고칠 수 있다.
- 음성 입력 원본 파일은 저장하지 않는다.
- 음성 인식 결과는 사용자가 확인한 뒤 저장된다.
- 브라우저가 음성 인식을 지원하지 않아도 글 입력으로 문진을 계속할 수 있다.
- 사용자가 사진을 첨부할 수 있다.
- 사용자가 영상을 첨부할 수 있다.
- `예`, `아니오`, `모르겠음` 답변이 저장된다.
- 문진은 4~5개 중심 질문 안에서 끝난다.
- 질문은 병명 기준이 아니라 증상, 시간, 위치, 정도, 변화, 동반 증상, 측정값 기준으로 나온다.
- 저장된 정보는 기본값으로 참고한다.
- 바뀔 수 있거나 현재 증상과 관련이 큰 저장 정보는 짧게 확인할 수 있다.
- 이미 이번 문진에서 답한 정보는 다시 묻지 않는다.

### AI

- Next.js 서버 API가 Hugging Face를 호출한다.
- 질문 생성 API가 다음 질문을 반환한다.
- 요약 생성 API가 S/O 요약을 반환한다.
- MedGemma 응답이 JSON이 아니면 서버가 실패 처리하거나 다시 시도한다.
- AI 응답에 진단명이나 치료 추천이 있으면 막는다.
- AI 질문에 병명 후보나 진단 가능성이 들어가면 막는다.
- AI 실패 시 다시 시도할 수 있다.
- AI 실패 시 수동 요약을 볼 수 있다.

### 수동 요약

- AI 전송 동의가 없어도 수동 요약을 볼 수 있다.
- Hugging Face 실패 시 수동 요약을 볼 수 있다.
- 수동 요약은 “입력 내용 정리”로 표시된다.
- 수동 요약은 “AI 요약”이라고 표시되지 않는다.
- 수동 요약에는 사용자 원문이 포함된다.
- 수동 요약에는 오늘 측정값이 포함된다.
- 수동 요약에는 사진/영상 첨부 목록이 포함된다.
- 수동 요약에는 위험 신호 안내 기록이 포함된다.
- 수동 요약에는 진단명, 병명 추측, 치료 추천이 들어가지 않는다.
- 수동 요약 PDF에는 “AI 요약 아님” 문구가 들어간다.

### 의료진용 요약 화면

- AI 요약과 입력 내용 정리가 명확히 구분된다.
- 화면 맨 위에 요약 종류, 생성 시간, 주의 문구가 보인다.
- 위험 신호가 있으면 요약 상단에 먼저 보인다.
- 주호소와 증상 경과가 S 영역에 정리된다.
- 사용자 제공 측정값, 사진 설명, 관찰 내용이 있으면 O 영역에 정리된다.
- O 영역에는 사용자 제공 참고 정보이며 의료진 확인 전 확정 정보가 아니라는 안내가 보인다.
- 확인 필요 항목은 S/O와 섞지 않고 따로 모아 보여준다.
- 사진과 영상 첨부 파일 목록이 보인다.
- 사용자가 입력한 원문 기록을 펼쳐 볼 수 있다.
- PDF 내보내기에도 같은 순서가 적용된다.

### 동의 / 개인정보

- 로컬 저장 동의를 받을 수 있다.
- AI 전송 동의를 받을 수 있다.
- 사진 AI 전송 동의를 받을 수 있다.
- AI 전송 동의가 없으면 MedGemma API를 호출하지 않는다.
- 사진 AI 전송 동의가 없으면 사진을 MedGemma로 보내지 않는다.
- AI 전송 동의를 거부해도 수동 문진과 수동 요약을 사용할 수 있다.
- 사용자가 설정에서 동의를 바꿀 수 있다.
- 동의 문구 버전이 바뀌면 다시 동의를 받을 수 있다.
- 서버 로그에 문진 본문, 사진, 의료정보를 남기지 않는다.

### 첨부

- 사진은 저장 전 1024px 정도로 압축된다.
- 원본 사진은 저장하지 않는다.
- 사진은 한 문진에 최대 3장까지 첨부할 수 있다.
- 사진 AI 전송 동의가 없으면 사진은 AI로 보내지 않는다.
- 사진을 AI에 보내지 않아도 의료진용 요약에 첨부 목록은 남는다.
- 영상은 AI 분석 없이 첨부로만 저장된다.
- 영상은 한 문진에 최대 1개까지 첨부할 수 있다.
- 영상은 50MB 이하만 허용한다.
- 첨부 실패가 있어도 문진은 계속할 수 있다.

### 잠금

- 사용자가 4자리 PIN 잠금을 켤 수 있다.
- PIN 원문은 저장하지 않는다.
- PIN은 salt를 붙인 해시로 저장한다.
- PIN을 켜면 앱 시작 시 잠금 화면이 먼저 보인다.
- PIN을 변경할 수 있다.
- PIN을 해제할 수 있다.
- PIN을 5번 연속 틀리면 1분 동안 다시 입력하지 못한다.
- 마지막 조작 후 10분이 지나면 다시 잠긴다.
- PIN을 잊어버리면 복구할 수 없고 앱 데이터 초기화가 필요하다고 안내한다.

### 오류

- AI 사용량 초과 시 다시 시도와 수동 요약을 제공한다.
- AI 연결 실패 시 작성 중인 내용을 잃지 않는다.
- MedGemma 응답 형식 오류 시 다시 시도와 수동 요약을 제공한다.
- AI 전송 동의가 없으면 MedGemma API를 호출하지 않는다.
- 사진 AI 전송 동의가 없으면 사진을 AI로 보내지 않고 첨부로만 남긴다.
- 음성 입력 실패 시 글 입력으로 전환할 수 있다.
- 첨부 파일 오류가 나도 문진은 계속할 수 있다.
- 저장 실패 시 다시 시도하거나 첨부를 줄일 수 있다.
- 오류 로그에는 오류 코드, 시간, 화면 이름 정도만 남긴다.
- 오류 로그에는 문진 본문, 사진, 의료정보를 남기지 않는다.

### 안전

- 이름, 연락처, 주민등록번호는 AI에 보내지 않는다.
- 위험 신호는 진단이 아니라 안전 안내로 보여준다.
- 강한 위험 신호가 있으면 일반 문진보다 안전 안내를 먼저 보여준다.
- `urgent` 안전 안내는 사용자가 확인하기 전까지 다음 일반 질문으로 넘어가지 않는다.
- 안전 안내에는 `119에 전화하기`, `주변 사람에게 보여주기`, `그래도 문진 계속하기`가 있다.
- `119에 전화하기`가 가장 크게 보인다.
- 안전 안내는 “응급입니다”라고 확정하지 않는다.
- 안전 안내는 “위험 신호가 있어요”라고 말한다.
- MedGemma가 저장을 직접 하지 않는다.
- 새 의료정보는 사용자 확인 후 저장한다.

## 19. 아직 구현 전에 정해야 하는 것

아래 내용은 구현 전에 한 번 더 정하면 좋다.

1. 수동 요약 화면에서 사용자가 직접 수정할 수 있게 할지

내 추천:

- 수동 요약은 처음에는 자동 정리만 하고, 직접 수정은 뒤로 미룬다.
