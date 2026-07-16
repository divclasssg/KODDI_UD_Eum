> [문서 인덱스](../2026-07-10-medical-interview-pwa-implementation-detail.md)
> 이전: [의료정보 장기 저장 후보](./003-의료정보-장기-저장-후보.md)
> 다음: [상태 설명](./005-상태-설명.md)

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
  editedByUser: boolean;
  editedAt?: string;
  createdAt: string;
};

type ManualSummaryItem = {
  id: string;
  label: string;
  value: string;
  originalValue?: string;
  source: "user_input" | "profile_snapshot" | "measurement" | "attachment";
  needsCheck?: boolean;
  editedByUser?: boolean;
};
```

규칙:

- 수동 요약은 병명이나 진단명을 만들지 않는다.
- 수동 요약은 S/O를 억지로 판단하지 않는다.
- 사용자가 입력한 내용과 저장된 참고 정보만 정리한다.
- 분류가 애매하면 “확인 필요”로 표시한다.
- 사진은 “사진 첨부 있음, 의료진 확인 필요”로 표시한다.
- 영상은 “영상 첨부 있음”으로만 표시한다.
- 사용자가 수동 요약을 직접 수정할 수 있다.
- 사용자가 수정해도 `originalUserText`는 바꾸지 않는다.
- 사용자가 항목 값을 수정하면 기존 값은 `originalValue`에 남길 수 있다.
- 사용자가 수정한 항목은 `editedByUser: true`로 표시한다.
- 사용자가 수정한 수동 요약은 “사용자가 수정함”을 표시한다.
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

