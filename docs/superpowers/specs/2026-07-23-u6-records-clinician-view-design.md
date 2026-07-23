# U6 기록·의료진 보기 설계

- 상태: 사용자 승인
- 작성일: 2026-07-23
- 우선순위 결정: U5 모의 음성·TTS를 보류하고 U6을 먼저 구현한다.
- 목표: 실제 IndexedDB 완료·진행 기록을 목록과 상세에서 다시 열고, 확정 완료 기록을 의료진용 화면으로 보여 주는 공개 사용자 여정을 완성한다.
## 범위

이번 구현에 포함한다.

- 홈의 `기록 보기` 진입점
- `/records` 기록 목록
- `/records/[id]` 기록 상세
- `/records/[id]/clinician` 의료진용 보기
- 실제 IndexedDB record·message·summary·profile snapshot 조회
- `Asia/Seoul` 기준 오늘·날짜·시간 표시와 정렬
- 완료, 검토 중, 진행 중, 안전 중단 상태 구분
- 빈 목록, 읽기 실패, 존재하지 않는 기록, 손상된 기록 복구 경로
- 393px 모바일과 데스크톱 공개 경로
- unit, IndexedDB integration, component, Chromium E2E 검증

이번 구현에서 제외한다.

- 검색과 필터
- PDF·JSON 내보내기
- Web Share와 외부 전송
- 첨부 파일 표시
- PIN 잠금
- 기록 편집·개별 삭제
- clinician 전용 인증·계정
- U5 모의 음성·TTS
## 선택한 접근

화면이 IndexedDB를 직접 읽지 않는다. 기존 database와 consent 경계를 사용하는 records 전용 read repository가 저장 record를 읽고, pure mapper가 화면용 view model을 만든다. 세 화면은 같은 read model을 사용해 날짜·상태·요약 출처·손상 판정을 중복하지 않는다.

fixture-first 접근은 사용하지 않는다. U4가 실제 completed aggregate를 이미 저장하므로 U6은 처음부터 실제 저장 데이터에 연결한다. fixture는 component test 입력으로만 사용한다.
## 파일과 책임

- `src/lib/db/records-repository.ts`
  - consent가 있는 database에서 record 목록과 단일 aggregate를 readonly transaction으로 읽는다.
  - 목록 조회는 record header와 첫 사용자 answer만 반환하고 상세 조회는 messages·summary를 함께 읽는다.
  - database version과 기존 8개 store를 변경하지 않는다.
- `src/features/records/records-view-model.ts`
  - 저장 record를 목록·상세·의료진 view model로 변환한다.
  - `Asia/Seoul` 날짜 경계, 정렬, 상태·출처 label, 주요 증상을 결정한다.
  - React와 IndexedDB를 import하지 않는다.
- `src/features/records/load-records.ts`
  - database 존재·consent·repository 오류를 공개 화면 상태로 일반화한다.
  - raw database 오류나 의료정보를 로그에 남기지 않는다.
- `src/features/records/record-list.tsx`
  - 목록, 빈 상태, 로딩, 오류와 재시도를 렌더링한다.
- `src/features/records/record-detail.tsx`
  - 요약과 원문 질문·답변을 분리해 렌더링한다.
- `src/features/records/clinician-view.tsx`
  - 완료·확정 요약만 렌더링하고 일반 관리 navigation을 숨긴다.
- `src/app/records/page.tsx`
- `src/app/records/[id]/page.tsx`
- `src/app/records/[id]/clinician/page.tsx`
  - Server Component page는 작은 Client Screen boundary만 렌더링한다.
## 읽기 계약

records repository는 다음 기능을 제공한다.

```ts
type StoredRecordListItem = {
  interview: InterviewRecord;
  firstAnswerText?: string;
};

type RecordsRepository = {
  list(): Promise<StoredRecordListItem[]>;
  load(interviewId: string): Promise<InterviewAggregateV1 | undefined>;
};
```

`list()`는 `interviews`와 `messages`를 같은 readonly transaction에서 읽고 각 record의 sequence가 가장 작은 사용자 answer만 결합한다. `load()`는 `interviews`, `messages`, `summaries`를 같은 readonly transaction에서 읽어 일관된 snapshot을 반환한다. message는 `sequence` 오름차순으로 정렬한다.

동의 record가 없으면 데이터를 반환하지 않고 `ConsentRequiredError`를 유지한다. 단일 record가 없으면 `undefined`를 반환한다. 다음 상태는 손상으로 판정한다.

- completed인데 confirmed summary가 없음
- summary의 `interviewId`가 record와 다름
- message sequence가 중복되거나 오름차순 연속성이 깨짐
- answer 앞에 대응하는 question이 없음
- profile snapshot이 필요한 completed record에 snapshot이 없음

손상된 내용은 부분 표시하지 않는다. 목록은 header와 첫 answer만 사용하므로 상세 aggregate 손상 여부를 단정하지 않는다. 상세와 의료진용 보기에서 손상을 발견하면 의료정보를 노출하지 않고 홈·기록 목록 복귀와 전체 삭제 경로를 제공한다.

## 목록 규칙

목록에는 completed, review, draft, safety-stopped를 모두 표시한다.

정렬 우선순위는 다음과 같다.

1. `Asia/Seoul` 기준 calendar date 최신순
2. 같은 날짜에서는 completed
3. safety-stopped
4. review
5. draft
6. 같은 상태에서는 `updatedAt` 최신순
7. 완전 동률이면 `id` 오름차순

각 행은 날짜 label, 시각, 상태, mode, 주요 증상을 표시한다.

- 오늘 record: `오늘`
- 과거 record: `YYYY년 M월 D일`
- completed: `완료`
- review: `확인 중`
- draft: `작성 중`
- safety-stopped: `안전 안내 후 중단`
- mode ai: `AI 문진`
- mode manual: `수동 문진`

주요 증상은 첫 사용자 answer message를 사용한다. 없거나 손상된 경우 `주요 증상 확인 필요`를 표시하며 다른 의료정보를 추측하지 않는다.

## 상세 화면

상세는 다음 순서로 표시한다.

1. 날짜·시간·상태
2. AI 문진 또는 수동 문진 label
3. 요약 출처
4. S: 사용자가 말한 내용
5. O: 사용자가 제공한 참고 정보
6. 확인 필요 항목
7. 원문 질문·답변
8. `의료진에게 보여주기` 또는 차단 이유

요약 출처 `ai`는 `AI가 정리한 내용`, `manual`은 `입력 내용 정리`로 표시한다. evidence ID는 화면에 노출하지 않지만 각 요약 항목의 근거 message가 현재 aggregate에 존재하는지 mapper가 다시 확인한다. 근거가 없으면 해당 항목을 부분 표시하지 않고 상세 전체를 손상 상태로 전환한다.

completed 이외 record에는 의료진 보기 버튼을 표시하지 않는다. 상태에 맞춰 `문진을 완료한 뒤 의료진용 화면을 열 수 있어요.` 또는 `안전 안내로 중단된 기록은 원문을 확인해 주세요.`를 표시한다.

## 의료진용 화면

진입 조건은 `interview.status === "completed"`와 `summary.status === "confirmed"`를 모두 만족하는 것이다. 조건이 맞지 않거나 record가 손상됐으면 내용은 렌더링하지 않는다.

화면 순서는 다음과 같다.

1. `의료진 참고용` heading과 진단·치료 안내가 아니라는 문구
2. 문진 날짜·시간과 요약 출처
3. safety message가 있으면 최상단 안전 안내
4. S
5. O와 `사용자가 제공한 참고 정보이며 의료진 확인이 필요합니다.`
6. 확인 필요 항목
7. 원문 질문·답변 펼치기
8. `기록 상세로 돌아가기`

프로필은 completed record의 immutable `profileSnapshot`만 사용한다. 현재 profile을 섞지 않는다. 이름·생년월일 전체는 기본 화면에 표시하지 않는다. 이번 범위에서는 snapshot의 성별과 의료정보도 자동 노출하지 않고 summary에 근거로 포함된 항목만 표시한다.

## 화면 상태와 navigation

- database 없음 또는 consent 없음: `/onboarding`으로 이동
- 목록 없음: 새 문진 시작과 홈으로 가기 제공
- 읽기 실패: 같은 화면에서 재시도와 홈으로 가기 제공
- record 없음: `기록을 찾을 수 없어요`와 목록 복귀 제공
- 손상: `이 기록을 안전하게 표시할 수 없어요`와 목록·전체 삭제 경로 제공
- 상세에서 뒤로: `/records`
- 의료진 화면 닫기: 같은 `/records/[id]`
- 홈에서 기록 진입: `/records`

navigation은 App Router를 사용한다. 목록 행은 의미 있는 link로 제공하고 keyboard focus와 최소 44px touch target을 유지한다.

## 안전·개인정보 경계

- 외부 API, Modal, GPU, AI 요청을 실행하지 않는다.
- 화면용 데이터는 브라우저의 기존 IndexedDB에서만 읽는다.
- raw record, summary, message, profile snapshot을 console이나 server log에 남기지 않는다.
- HTML·Markdown으로 해석하지 않고 React text로 렌더링한다.
- clinician 화면은 인증된 의료진 포털이 아니라 사용자가 같은 기기에서 보여 주는 전용 view다.
- draft·review·safety-stopped와 근거가 깨진 summary는 clinician 화면에 노출하지 않는다.

## 검증

- pure unit
  - 서울 날짜 label과 자정 경계
  - 오늘 우선·completed 우선·최신순·ID tie-break 정렬
  - 상태·mode·summary 출처 label
  - 첫 사용자 답변 주요 증상 선택
  - evidence 누락과 message sequence 손상 거절
- IndexedDB integration
  - 목록 header 조회
  - 단일 aggregate의 같은 transaction snapshot
  - consent 없음, record 없음, completed confirmed summary
- component
  - 목록·빈 상태·오류
  - 상세 요약·원문·clinician 차단 이유
  - clinician 화면 정보 계층과 일반 관리 navigation 부재
- Chromium E2E
  - 합성 온보딩과 문진 완료 후 홈 → 기록 → 오늘 기록 → 상세 → 의료진 보기
  - 같은 `interviewId`와 실제 IndexedDB completed aggregate 확인
  - 외부 AI request는 deterministic mock으로 제한하고 actual GPU는 실행하지 않음

## 완료 기준

- 세 공개 route가 모두 실제 IndexedDB 데이터로 동작한다.
- 오늘 완료 기록을 홈에서 두 단계 안에 찾는다.
- 상세에서 요약과 원문을 구분한다.
- 완료·확정 기록만 의료진용 화면에 노출된다.
- 393px에서 핵심 정보와 닫기 행동을 가로 스크롤 없이 사용할 수 있다.
- 관련 unit·integration·component·Chromium E2E와 lint·typecheck가 통과한다.
