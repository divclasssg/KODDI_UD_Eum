> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [검증 계약과 완료 기준](./09-verification-and-dod.md)
> 다음: 없음
## Deferred / Open Questions

다음 항목은 headless 문서 리뷰에서 제품·도메인·보안 판단이 필요한 것으로 분류되어 자동 반영하지 않았다. U1은 시작할 수 있지만, 해당 의존 작업 전에 Day 1~2에서 동결해야 한다.

1. **의료 콘텐츠 계약:** required slot, 조기 종료·중복 기준, 위험 rule별 `stop_and_save | manual_summary`, 승인 문구, 중간 AI 실패 시 남은 manual 질문 선택, actual 모델 생성 parameter와 반복 성공 기준을 누가 승인할 것인가?
2. **API·로컬 데이터 계약:** `AiInterviewContextV1` question/summary request·response, `ask | complete` union, stale/nil/empty/oversize 처리, IndexedDB v1 store·index·UTC timestamp·upgrade/reset 범위를 어떤 schema로 고정할 것인가?
3. **Profile·의료진 화면 계약:** P0 기본·의료정보 필드, 필수·선택·미확인 표시, snapshot·AI context 포함 여부, clinician view 최소 정보 계층, `ai-unmodified | ai-user-edited | manual` provenance와 의미적 contradiction 검증 범위를 확정해야 한다.
4. **상호작용·접근성 계약:** 홈·기록·내 정보 전역 navigation, 요약 수정 뒤 재생성·focus 복귀와 TTS 상태를 확정해야 한다. 대표 문진은 393×852 고정 프레임, 200% zoom scroll 접근, 실제 녹음·STT 없는 모의 음성으로 확정했다.
5. **7일 recovery ladder:** Modal actual gate가 늦을 때 TTS 또는 Figma 정밀 반영을 내릴 수 있는지, 사진을 조건부로 유지할지 완전 후속으로 넘길지 결정해야 한다. actual MedGemma·근거 요약·Task 2·3 최소 route는 보호한다.
6. **지원 사용자 경계:** 보호자·보조자 A5를 이번 P0 지원 대상으로 넣을지, 설명적 맥락으로만 두고 후속 범위로 넘길지 결정해야 한다.

확정 결정: 공개 데모는 로그인 없이 합성 Persona 역할극으로 제공한다. mock과 인증된 Modal adapter를 분리하고 session 5회/분, IP 20회/시간, 전체 actual 100회/일, Workspace `$10` hard cap을 적용한다. 상세 계약은 [Modal 외부 데모 설계](../../superpowers/specs/2026-07-20-modal-medgemma-external-demo-design.md)를 따른다.

---

## Appendix

### Source-to-App Mapping

| 새 문서 내용 | 이번 구현에서의 사용 | 구현하지 않는 것 |
|---|---|---|
| 공통 참가자 프롬프트 | 현재 화면만으로 이해 가능한 라벨, 입력 방식 선택·변경 | Think Aloud 실행 엔진, screenshot relay |
| 김영수 Persona | 큰 글씨, 쉬운 말, 설명 우선, TTS | 김영수 AI 시뮬레이션 |
| 이민정 Persona | 한 질문, 구체 문장, 익숙한 pattern | 이민정 AI 시뮬레이션 |
| 박성훈 Persona | 짧은 답변, 칩·음성, 낮은 입력 부담 | 박성훈 AI 시뮬레이션 |
| 상황 1 | onboarding, 실제 AI 문진, 입력 방식, 요약 검토·확정 | 상황 종료 인터뷰 자동화 |
| 상황 2 | 기록, 오늘 기록, clinician view | 평가자 채점 |
| 상황 3 | 과거 기록, profile edit | Synthetic SUS 계산 |
| 평가자 프롬프트 | product gate와 오류·접근성 fixture | AI 평가자, 심각도·2/3 자동 판정 |

### Seven-Day Reality Check

새 문서의 상황 2와 3은 부가 기능이 아니라 앱 과업이므로 P0에서 뺄 수 없다. 대신 사진은 core gate 이후 조건부로 두고, UT 실행 자동화·PWA cache·PIN·export·영상은 제외한다. 7일 안에 모두 구현하지 못할 때 버려야 할 것은 실제 문진·기록·의료진 보기·내 정보 수정이 아니라 조건부 사진과 비핵심 플랫폼 기능이다.
