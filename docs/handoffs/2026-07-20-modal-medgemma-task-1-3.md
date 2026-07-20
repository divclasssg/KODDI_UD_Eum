---
artifact_contract: "ce-handoff/v1"
created_at: "2026-07-20T13:04:35Z"
title: "Modal MedGemma Task 1~3 구현 인계"
summary: "공개 합성 페르소나 데모의 계약, Next.js 보호 계층, Modal 런타임 기반을 완료했으며 Task 4 화면 연결부터 재개한다."
keywords: ["modal", "medgemma", "interview", "handoff"]
repository: "KODDI_UD_Eum"
repo_root_sha: "dc4bc5d9f17b1360239c706ce5672102b4adb52d"
branch: "codex/modal-contracts"
implementation_head: "ac5be27ac79db330777f9846f736d24e7e0514b3"
worktree_path: "/Users/seikpark/Desktop/projects/KODDI_UD_Eum/.worktrees/modal-contracts"
resume_focus: "Modal 구현 계획 Task 4 실제 문진 화면 연결과 fallback"
---

# Modal MedGemma Task 1~3 구현 인계

## 현재 목표

링크를 아는 외부 사용자가 로그인 없이 합성 페르소나 역할극을 체험한다. 브라우저는 Next.js Route Handler만 호출하고, Modal MedGemma 장애·제한·검증 실패가 발생해도 저장된 문진 기록을 잃지 않고 수동 흐름으로 완주해야 한다.

## 완료된 작업

- Task 1: persona·slot·질문·요약 DTO, exact validator, 직접 식별정보 탐지기, 공유 command port를 구현했다.
- Task 2: server-only provider, mock·Modal adapter, 익명 세션/HMAC, 요청 보호 계층, question·summary Route Handler를 구현했다.
- Task 3: Pydantic schema, 영속 quota gate, CPU 인증 endpoint, T4 GPU 함수, quota smoke app을 구현했다.
- 구현 기준 커밋은 `ac5be27 feat(ai): add guarded Modal MedGemma foundation`이다.
- 상위 계획과 Task 1~3 체크리스트, 활성 7일 계획, 구현 체크리스트, 작업일지를 현재 사실로 갱신했다.

## 중요한 결정과 제약

- 실제 환자 정보·실제 건강정보·사진·음성·마이크·STT는 범위 밖이다.
- 합성 페르소나와 비식별 데모 데이터만 사용한다.
- 질문 수가 상황에 따라 달라지므로 단계 번호와 고정 진행률을 표시하지 않는다.
- 실제 음성처럼 보이는 기능은 미리 작성된 합성 transcript를 채울 뿐 자동 제출하지 않는다.
- 브라우저에 Modal URL, proxy token, Hugging Face token을 노출하지 않는다.
- 실제 provider 출력과 입력은 양쪽 런타임에서 다시 검증하며 원문을 로그에 남기지 않는다.
- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 고정 모바일 화면은 393×852 기준이며 반응형 구현은 요구하지 않는다.

## 구현상 주의할 점

- `MedGemmaProvider`는 quota용 session/IP HMAC 전달을 위해 승인 초안보다 세 번째 `AiRequestIdentity` 인자를 받는다.
- Modal endpoint는 승인된 schema 오류 HTTP 400을 보장하기 위해 자동 request body binding 대신 `InferenceRequest.model_validate()`를 직접 호출한다.
- `429`, `503`, 일시적 전송 오류만 한 번 재시도하고 인증·schema 오류는 재시도하지 않는다.
- `MEDGEMMA_ACTUAL_DISABLED=1`이 기본값이다. 실제 배포 전까지 해제하지 않는다.

## 최신 검증 증거

2026-07-20 Task 1~3 누적 변경에서 다음을 통과했다.

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`: 9개 파일, 69건
- `npm run test:icons`: 6건
- `npm run test:tokens`: 4건
- `npm run build`: Next.js 16.2.10 Turbopack
- `npm run test:e2e`: webpack production build와 Chromium 14건
- `.venv/bin/python -m pytest tests/modal`: 4개 파일, 25건
- `.venv/bin/python -m compileall -q inference tests/modal`
- `.venv/bin/python -m pip check`
- `git diff --check`

worktree의 별도 lockfile 때문에 Next.js가 저장소 루트를 추론했다는 경고가 나오지만 빌드와 E2E는 통과한다.

## 내일 첫 작업

1. `/Users/seikpark/Desktop/projects/KODDI_UD_Eum/.worktrees/modal-contracts`에서 `codex/modal-contracts` 브랜치와 clean status를 확인한다.
2. [Task 4 실제 화면 연결과 fallback](../superpowers/plans/2026-07-20-modal-medgemma-external-demo-implementation-plan/04-interview-integration.md)을 읽는다.
3. Step 1의 HTTP command·전환 실패 테스트부터 작성하고 TDD 순서로 진행한다.
4. 일반 `/interview/new`에는 HTTP adapter, 승인된 fixture query에는 fixture adapter를 연결한다.
5. 역할극 확인 전 actual 요청 0회, stale 요청 폐기, provider 실패 시 history 유지와 수동 질문·결정론적 요약 fallback을 검증한다.
6. Task 4의 좁은 검증을 통과한 뒤 Task 5 actual gate로 넘어가기 전에 외부 상태 변경 승인을 다시 확인한다.

## 아직 하지 않은 작업

- [Task 4 실제 화면 연결과 fallback](../superpowers/plans/2026-07-20-modal-medgemma-external-demo-implementation-plan/04-interview-integration.md)
- [Task 5 actual gate·문서·최종 검증](../superpowers/plans/2026-07-20-modal-medgemma-external-demo-implementation-plan/05-actual-and-docs.md)
- 실제 Modal Secret 생성, 모델 약관·Hugging Face token 준비, proxy token 생성
- Modal Workspace 월 $30 hard cap 설정
- Modal app 배포, T4 GPU 기동, actual·quota abuse·외부 공개 검증
- [모의 음성 입력 구현 계획](../superpowers/plans/2026-07-20-simulated-voice-input-implementation-plan.md)의 3개 Task

Task 5의 배포와 실제 GPU 호출은 비용 및 외부 상태를 변경하므로 사용자 승인과 준비 여부를 확인한 뒤 실행한다. 비밀값은 채팅·문서·git에 복사하지 않는다.

## 재개 명령

```text
/ce-handoff resume /Users/seikpark/Desktop/projects/KODDI_UD_Eum/.worktrees/modal-contracts/docs/handoffs/2026-07-20-modal-medgemma-task-1-3.md
```
