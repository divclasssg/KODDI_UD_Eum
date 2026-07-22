> [상위 설계](../2026-07-22-u2-indexeddb-v1-repository-design.md)

# Schema와 저장 구조

## Database와 공통 값

```ts
export const DATABASE_NAME = "koddi-ud-eum";
export const DATABASE_VERSION = 1;
```

모든 timestamp는 `new Date().toISOString()` 형식의 UTC ISO 8601 millisecond 값만 허용한다. 예시는 `2026-07-22T01:23:45.678Z`다. offset, millisecond 없는 값, locale 문자열, 숫자 epoch는 거절한다. `Asia/Seoul` 날짜 분류는 조회 계층에서 변환한다.

모든 레코드는 `schemaVersion: 1`을 가진다. singleton key는 consent `current`, profile과 medical profile `default`로 고정한다. 나머지 ID는 application이 만든 빈 문자열이 아닌 opaque string이다.

## Object store, key와 index

| Store | keyPath | index |
|---|---|---|
| `consents` | `id` | 없음 |
| `profiles` | `id` | 없음 |
| `medicalProfiles` | `id` | 없음 |
| `interviews` | `id` | `byStatus`, `byUpdatedAt`, `byStatusUpdatedAt` |
| `interviewDrafts` | `interviewId` | `byUpdatedAt` |
| `messages` | `id` | `byInterviewId`, unique `byInterviewSequence` |
| `summaries` | `interviewId` | `byStatus`, `byUpdatedAt` |
| `attachments` | `id` | `byInterviewId`, `byInterviewCreatedAt`, `byKind` |

compound key는 각각 `[status, updatedAt]`, `[interviewId, sequence]`, `[interviewId, createdAt]`이다. `attachments`는 v1 schema와 reset 검증에 포함하지만 사진 기능은 구현하지 않는다.

## Consent

```ts
type ConsentRecordV1 = {
  id: "current";
  schemaVersion: 1;
  localStorage: {
    state: "granted";
    noticeVersion: string;
    decidedAt: UtcTimestamp;
  };
  sensitiveHealth: {
    state: "granted";
    noticeVersion: string;
    decidedAt: UtcTimestamp;
  };
  aiTransfer: {
    state: "granted" | "declined";
    noticeVersion: string;
    decidedAt: UtcTimestamp;
  };
  updatedAt: UtcTimestamp;
};
```

최초 local 저장 거부, 민감정보 처리 거부와 만료된 동의는 DB를 열거나 record를 쓰지 않는다. 이미 동의한 사용자가 철회하면 새 임상 쓰기를 먼저 막고 consent singleton만 삭제한다. AI 거부는 로컬에 저장하며 manual 기록 저장은 허용한다.

## Profile과 medical profile

```ts
type ProfileRecordV1 = {
  id: "default";
  schemaVersion: 1;
  displayName: string;
  birthDate: `${number}-${number}-${number}`;
  sex: "female" | "male" | "other" | "unknown";
  updatedAt: UtcTimestamp;
};

type KnownTextListV1 =
  | { state: "known"; values: string[] }
  | { state: "unknown" };

type LifestyleAnswerV1 =
  | { state: "yes"; details?: string }
  | { state: "no" }
  | { state: "unknown" };

type MedicalProfileRecordV1 = {
  id: "default";
  schemaVersion: 1;
  conditions: KnownTextListV1;
  medications: KnownTextListV1;
  allergies: KnownTextListV1;
  familyHistory: KnownTextListV1;
  medicalHistory: KnownTextListV1;
  surgicalHistory: KnownTextListV1;
  smoking: LifestyleAnswerV1;
  alcohol: LifestyleAnswerV1;
  heightCm?: number;
  weightKg?: number;
  updatedAt: UtcTimestamp;
};
```

`birthDate`는 유효한 `YYYY-MM-DD` 날짜만 저장하고 나이는 저장하지 않는다. 온보딩은 서울 달력 날짜를 기준으로 만 14세 이상인지 계산한다. 만 14세 미만은 동의 화면이나 repository에 도달하지 않으며 database open과 write가 모두 0회다. 생년월일은 AI 요청 payload에 넣지 않는다.

직접 연락처, 주소, 주민등록번호, 병원 번호, 비상 연락처와 기기 식별자는 저장하지 않는다. 빈 `values`는 “없음”을 확인한 상태이고 `unknown`은 미확인 상태다. 흡연·음주는 `yes | no | unknown`을 명시하고 `yes`일 때만 선택 메모를 저장한다.

## Interview, draft와 history

```ts
type InterviewStatusV1 =
  | "draft"
  | "review"
  | "completed"
  | "safety-stopped";

type InterviewRecordV1 = {
  id: string;
  schemaVersion: 1;
  revision: number;
  status: InterviewStatusV1;
  mode: "ai" | "manual";
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  completedAt?: UtcTimestamp;
  profileSnapshot?: CompletedProfileSnapshotV1;
};

type InterviewDraftRecordV1 = {
  interviewId: string;
  schemaVersion: 1;
  revision: number;
  currentQuestion: InterviewQuestionSnapshotV1;
  input: {
    mode: "text" | "choice" | "measurement" | "simulated-voice";
    text: string;
    selectedOptionIds: string[];
    measurement?: { value: number; unit: string };
  };
  updatedAt: UtcTimestamp;
};
```

revision은 1부터 시작하고 durable aggregate 변경 transaction마다 1 증가한다. 허용 전이는 `draft → review → completed`, `draft → safety-stopped`, `review → draft`다. terminal status는 삭제 외 mutation을 거절한다. `saving`, AI 대기, TTS 상태는 저장하지 않는다.

`messages`에는 commit된 history만 sequence 순서로 저장한다. 현재 질문과 미제출 input은 `interviewDrafts`에 둔다. 복원은 consent, interview, draft, messages, summary를 한 readonly transaction에서 읽고 revision·sequence 불일치 시 부분 복원 대신 `DatabaseCorruptionError`를 반환한다.

## Summary와 완료 snapshot

summary status는 `draft | review | confirmed`, source는 `ai | manual`이다. AI 항목은 현재 문진 message ID를 `evidenceMessageIds`로 보존한다. manual summary도 원문 ID를 유지하고 AI 결과로 표시하지 않는다.

```ts
type CompletedProfileSnapshotV1 = {
  schemaVersion: 1;
  capturedAt: UtcTimestamp;
  profile: Omit<ProfileRecordV1, "id" | "updatedAt">;
  medicalProfile: Omit<MedicalProfileRecordV1, "id" | "updatedAt">;
};
```

완료 transaction은 현재 두 profile을 deep clone해 snapshot에 넣고 summary를 `confirmed`, interview를 `completed`로 바꾼다. terminal record의 generic `put`은 공개하지 않아 이후 profile 수정이 과거 snapshot에 영향을 주지 못하게 한다.
