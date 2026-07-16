
# 의료 취약군 문진 보조 앱 구현 상세 설계서

> 상태: 과거 참고자료. 현재 구현 판단에는 2026-07-16 실행 계획을 우선합니다.

- 전체 문서 인덱스: [docs/README.md](../../README.md)
- 현재 실행 계획: [2026-07-16 7일 구현 계획](../../plans/2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
- 분리 전 원문 줄 수: 3584
- 상세 문서 수: 21
- 관리 규칙: 상위·상세 문서 모두 200줄 이하

## 상세 문서

1. [의료 취약군 문진 보조 앱 구현 상세 설계서](./2026-07-10-medical-interview-pwa-implementation-detail/001-의료-취약군-문진-보조-앱-구현-상세-설계서.md)
2. [문진 메시지](./2026-07-10-medical-interview-pwa-implementation-detail/002-문진-메시지.md)
3. [의료정보 장기 저장 후보](./2026-07-10-medical-interview-pwa-implementation-detail/003-의료정보-장기-저장-후보.md)
4. [4. IndexedDB 저장 구조](./2026-07-10-medical-interview-pwa-implementation-detail/004-4-indexeddb-저장-구조.md)
5. [상태 설명](./2026-07-10-medical-interview-pwa-implementation-detail/005-상태-설명.md)
6. [6. Next.js API 설계](./2026-07-10-medical-interview-pwa-implementation-detail/006-6-next-js-api-설계.md)
7. [7. Hugging Face 호출 방식](./2026-07-10-medical-interview-pwa-implementation-detail/007-7-hugging-face-호출-방식.md)
8. [S/O 요약 생성 요청](./2026-07-10-medical-interview-pwa-implementation-detail/008-s-o-요약-생성-요청.md)
9. [로컬 저장 동의](./2026-07-10-medical-interview-pwa-implementation-detail/009-로컬-저장-동의.md)
10. [수동 요약으로 전환하는 경우](./2026-07-10-medical-interview-pwa-implementation-detail/010-수동-요약으로-전환하는-경우.md)
11. [수동 요약 저장 규칙](./2026-07-10-medical-interview-pwa-implementation-detail/011-수동-요약-저장-규칙.md)
12. [확인 필요 항목 표시 규칙](./2026-07-10-medical-interview-pwa-implementation-detail/012-확인-필요-항목-표시-규칙.md)
13. [질문 생성 입력 데이터](./2026-07-10-medical-interview-pwa-implementation-detail/013-질문-생성-입력-데이터.md)
14. [질문 생성 프롬프트 예시](./2026-07-10-medical-interview-pwa-implementation-detail/014-질문-생성-프롬프트-예시.md)
15. [재시도 프롬프트](./2026-07-10-medical-interview-pwa-implementation-detail/015-재시도-프롬프트.md)
16. [4단계: 질문 품질 검증](./2026-07-10-medical-interview-pwa-implementation-detail/016-4단계-질문-품질-검증.md)
17. [영상 처리](./2026-07-10-medical-interview-pwa-implementation-detail/017-영상-처리.md)
18. [PIN 변경](./2026-07-10-medical-interview-pwa-implementation-detail/018-pin-변경.md)
19. [AI 전송 동의 없음](./2026-07-10-medical-interview-pwa-implementation-detail/019-ai-전송-동의-없음.md)
20. [18. 환경 변수](./2026-07-10-medical-interview-pwa-implementation-detail/020-18-환경-변수.md)
21. [의료진용 요약 화면](./2026-07-10-medical-interview-pwa-implementation-detail/021-의료진용-요약-화면.md)

## 문서 사용 규칙

- 이 파일은 탐색과 상태 확인을 위한 상위 문서다.
- 실제 내용은 위 상세 문서에서 관리한다.
- 같은 내용을 여러 파일에 복사하지 않고 상대 링크로 참조한다.
- 세부 문서를 수정하면 관련 인덱스와 링크 검사를 함께 수행한다.
