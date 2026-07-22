> [상위 설계](../2026-07-22-u2-indexeddb-v1-repository-design.md)

# Repository·Reset·Migration 정책

## 공개 port

```ts
type RevisionToken = {
  interviewId: string;
  expectedRevision: number;
  runtimeGeneration: number;
};

interface ConsentRepository {
  getCurrent(): Promise<ConsentRecordV1 | undefined>;
  grant(input: GrantConsentInputV1): Promise<ConsentRecordV1>;
  withdrawLocalStorage(): Promise<void>;
}

interface ProfileRepository {
  getBundle(): Promise<ProfileBundleV1 | undefined>;
  saveBundle(input: SaveProfileBundleInputV1): Promise<ProfileBundleV1>;
}

interface InterviewRepository {
  create(input: CreateInterviewInputV1): Promise<InterviewAggregateV1>;
  loadInProgress(id: string): Promise<InterviewAggregateV1 | undefined>;
  saveProgress(token: RevisionToken, input: SaveProgressInputV1): Promise<InterviewAggregateV1>;
  saveSummary(token: RevisionToken, input: SaveSummaryInputV1): Promise<InterviewAggregateV1>;
  complete(token: RevisionToken): Promise<InterviewAggregateV1>;
  listCompleted(): Promise<InterviewRecordV1[]>;
}

interface LocalDataRepository {
  resetAll(): Promise<void>;
  countAll(): Promise<Record<StoreNameV1, number>>;
}
```

UI는 IndexedDB를 직접 호출하지 않는다. 모든 임상 쓰기는 `consents`를 같은 transaction에서 읽어 local grant를 확인한다. 기존 문진 mutation은 interview를 먼저 읽고 누락, revision 불일치, terminal status를 거절하며 절대 upsert로 되살리지 않는다.

## Reset transaction

1. application service가 runtime generation을 증가시킨다.
2. AI `AbortController`, TTS, 모의 음성 timer를 취소한다.
3. 8개 store를 포함한 readwrite transaction 하나를 연다.
4. 모든 store에 `clear()`를 호출한다.
5. transaction `complete` 뒤에만 성공을 반환한다.

request 오류나 abort가 발생하면 부분 삭제는 commit되지 않는다. 성공 뒤 8개 store count는 모두 0이다.

늦은 응답은 command가 캡처한 runtime generation을 먼저 검사한다. repository는 transaction 안에서 consent, interview 존재, expected revision, non-terminal status를 다시 검사한다. reset 전 write가 먼저 commit되면 reset이 지우고, reset 뒤 write는 consent와 interview가 없어 실패한다.

## Upgrade와 실패 정책

- `onupgradeneeded` versionchange transaction에서 `0 → 1` migration을 수행한다.
- 향후 migration은 version별 순차 함수로 추가한다.
- migration request 오류나 throw는 versionchange transaction을 abort한다.
- 실패 시 DB를 삭제하거나 빈 v1으로 자동 재생성하지 않는다.
- migration 실패는 `DatabaseMigrationError`로 반환하고 application write를 막는다.
- 높은 DB version은 `DatabaseVersionTooNewError`로 변환한다.
- 기존 connection은 `versionchange`에서 닫는다.
- `blocked`는 `DatabaseUpgradeBlockedError`로 노출한다.

데이터 보존이 destructive recovery보다 우선이다.

## 오류 계약

- `ConsentRequiredError`: local consent 없음 또는 만료
- `RevisionConflictError`: expected revision 불일치
- `InterviewNotFoundError`: reset 등으로 대상 누락
- `ImmutableInterviewError`: terminal 기록 mutation
- `DatabaseCorruptionError`: aggregate revision·sequence 불일치
- `DatabaseMigrationError`: upgrade transaction 실패
- `DatabaseUpgradeBlockedError`: 다른 connection이 upgrade 차단
- `DatabaseVersionTooNewError`: 현재 앱보다 높은 DB version

오류와 로그에는 본문, profile 값, Blob, credential을 넣지 않는다. error code, store/operation 이름, UTC 시각만 허용한다.
