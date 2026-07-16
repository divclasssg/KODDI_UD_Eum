
# 의료 취약군 문진 보조 앱 구현 상세 설계서

> 상태: 과거 참고자료. 현재 구현 판단에는 2026-07-16 실행 계획을 우선합니다.

- 전체 문서 인덱스: [docs/README.md](../../README.md)
- 현재 실행 계획: [2026-07-16 7일 구현 계획](../../plans/2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
- 분리 전 원문 줄 수: 3688
- 상세 문서 수: 21
- 관리 규칙: 상위·상세 문서 모두 200줄 이하

## 상세 문서

1. [의료 취약군 문진 보조 앱 구현 상세 설계서](./2026-07-13-medical-interview-pwa-implementation-detail/001-의료-취약군-문진-보조-앱-구현-상세-설계서.md)
2. [안전 안내](./2026-07-13-medical-interview-pwa-implementation-detail/002-안전-안내.md)
3. [앱 오류](./2026-07-13-medical-interview-pwa-implementation-detail/003-앱-오류.md)
4. [수동 요약](./2026-07-13-medical-interview-pwa-implementation-detail/004-수동-요약.md)
5. [5. 문진 상태 흐름](./2026-07-13-medical-interview-pwa-implementation-detail/005-5-문진-상태-흐름.md)
6. [`예 / 아니오 / 모르겠음` 처리](./2026-07-13-medical-interview-pwa-implementation-detail/006-예-아니오-모르겠음-처리.md)
7. [`POST /api/ai/summary`](./2026-07-13-medical-interview-pwa-implementation-detail/007-post-api-ai-summary.md)
8. [모델 id 규칙](./2026-07-13-medical-interview-pwa-implementation-detail/008-모델-id-규칙.md)
9. [구현 파일](./2026-07-13-medical-interview-pwa-implementation-detail/009-구현-파일.md)
10. [동의 변경과 철회](./2026-07-13-medical-interview-pwa-implementation-detail/010-동의-변경과-철회.md)
11. [수동 요약 항목 생성 예](./2026-07-13-medical-interview-pwa-implementation-detail/011-수동-요약-항목-생성-예.md)
12. [수동 요약 화면 순서](./2026-07-13-medical-interview-pwa-implementation-detail/012-수동-요약-화면-순서.md)
13. [프롬프트 설계 원칙](./2026-07-13-medical-interview-pwa-implementation-detail/013-프롬프트-설계-원칙.md)
14. [질문 생성 프롬프트 예시](./2026-07-13-medical-interview-pwa-implementation-detail/014-질문-생성-프롬프트-예시.md)
15. [재시도 프롬프트](./2026-07-13-medical-interview-pwa-implementation-detail/015-재시도-프롬프트.md)
16. [3단계: 안전 문장 검증](./2026-07-13-medical-interview-pwa-implementation-detail/016-3단계-안전-문장-검증.md)
17. [사진 처리](./2026-07-13-medical-interview-pwa-implementation-detail/017-사진-처리.md)
18. [PIN 설정](./2026-07-13-medical-interview-pwa-implementation-detail/018-pin-설정.md)
19. [모델 로딩 중](./2026-07-13-medical-interview-pwa-implementation-detail/019-모델-로딩-중.md)
20. [잠금 오류](./2026-07-13-medical-interview-pwa-implementation-detail/020-잠금-오류.md)
21. [문진](./2026-07-13-medical-interview-pwa-implementation-detail/021-문진.md)

## 문서 사용 규칙

- 이 파일은 탐색과 상태 확인을 위한 상위 문서다.
- 실제 내용은 위 상세 문서에서 관리한다.
- 같은 내용을 여러 파일에 복사하지 않고 상대 링크로 참조한다.
- 세부 문서를 수정하면 관련 인덱스와 링크 검사를 함께 수행한다.
