> [상위 설계](../2026-07-22-u3-interview-state-input-contracts-design.md)

# 질문 Snapshot·공통 Draft·Validation

## Question snapshot

새 문진은 질문 세트 전체를 생성 시점에 deep snapshot으로 보관한다.

```ts
type QuestionSetSnapshotV2 = {
  contractVersion: 2;
  id: "manual-intake-v1" | string;
  questions: QuestionSnapshotV2[];
};

type QuestionSnapshotV2 = {
  contractVersion: 2;
  id: string;
  slot: string;
  text: string;
  allowedModes: InputModeV2[];
  defaultMode: InputModeV2;
  contracts: {
    text?: TextInputContractV2;
    choice?: OptionInputContractV2;
    chip?: ChipInputContractV2;
    measurement?: MeasurementInputContractV2;
  };
};
```

진행 중에는 저장된 snapshot만 사용하며 배포된 registry의 같은 ID로 다시 해석하지 않는다. 완료 시 draft store를 삭제해도 interview record의 question-set snapshot은 남는다. profile snapshot과 question snapshot은 이후 profile·질문 registry 수정으로 바뀌지 않는다.

## Common draft

```ts
type InputModeV2 = "text" | "choice" | "chip" | "measurement";

type CommonDraftV2 = {
  contractVersion: 2;
  questionId: string;
  activeMode: InputModeV2;
  values: {
    text: { value: string };
    choice: { selectedOptionIds: string[] };
    chip: { selectedOptionIds: string[] };
    measurement: {
      state: "empty" | "known" | "unknown";
      rawValue: string;
      unitId: string;
      measuredAtLocal: string;
    };
  };
};
```

mode switch는 `activeMode`만 바꾸며 다른 mode의 값을 지우지 않는다. `unknown` 전환도 rawValue, unitId, measuredAtLocal을 보존하고 answer serialization에서만 제외한다. question ID가 다르면 이전 draft를 재사용하지 않는다.

simulated voice와 photo는 U3 draft mode가 아니다. 공개 진입점은 준비 중 dialog를 유지하고 media port를 호출하지 않는다. 향후 실제 media 설계가 승인되면 text provenance를 별도 version으로 추가한다.

## Input contracts

- text: trim 후 최소·최대 길이, 빈 값 허용 여부
- choice: snapshot option allowlist, single/multiple, unknown option의 상호배타
- chip: `symptom | duration | severity` presentation kind, single/multiple, option allowlist, unknown/none 상호배타
- measurement: decimal, 허용 unit ID 목록, optional min/max, 측정 시각 `required | optional | hidden`, unknown 허용 여부

min/max는 진단 기준이 아니라 형식상 불가능한 값 차단에만 사용한다. 공개 질문별 범위는 의료 콘텐츠 승인 없이 추가하지 않는다.

## Validation

```ts
type DraftValidationResult =
  | { status: "valid"; answer: ValidatedAnswerV2 }
  | { status: "incomplete"; issues: ValidationIssue[] }
  | { status: "invalid"; issues: ValidationIssue[] };

type ValidationIssue = {
  code: "required" | "unknown-not-allowed" | "option-not-allowed" | "invalid-number" | "out-of-range" | "unit-required" | "measured-at-required" | "invalid-measured-at";
  path: "text" | "choice" | "chip" | "measurement.value" | "measurement.unit" | "measurement.measuredAt";
};
```

validation은 question snapshot과 common draft만 받는 pure function이다. UI 문구는 issue code를 한국어 copy로 매핑한다. repository에는 validation result를 저장하지 않고 validated answer와 original question snapshot reference만 저장한다.

measurement의 known answer는 locale 문자열이 아닌 finite number, snapshot의 canonical unit ID, UTC ISO measuredAt 또는 `null`을 가진다. unknown answer는 `{ state: "unknown" }`만 commit한다. empty는 submit할 수 없다.

## 공개 manual 적용

- chief complaint: text 유지. 승인 없는 증상 preset을 추가하지 않는다.
- onset: 기존 승인 선택지를 duration chip으로 표시하고 text mode 전환을 허용한다.
- pattern: choice와 text mode 전환.
- severity: 기존 승인 선택지를 severity chip으로 표시하고 text mode 전환을 허용한다.
- additional: text와 `추가 내용 없음` choice 전환.
- measurement: 공통 adapter와 합성 integration fixture까지만 구현하고 공개 질문 연결은 별도 콘텐츠 승인 뒤 수행한다.
