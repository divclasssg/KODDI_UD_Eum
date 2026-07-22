<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 주석 규칙

- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.

# 검증 실행 원칙

- 목표는 검증을 생략하는 것이 아니라 같은 tree에 대한 중복 전체 검증을 줄이는 것이다.
- TDD의 RED/GREEN 단계에서는 변경과 직접 관련된 최소 test file 또는 test name만 실행한다.
- 논리 작업 단위가 끝나면 영향받은 unit·integration test만 실행한다.
- lint, typecheck, 전체 unit, 전체 integration은 milestone 마지막에 한 번 실행하며 서로 독립적이면 병렬 실행한다.
- 관련 Chromium E2E를 먼저 실행하고 전체 E2E는 commit·push·merge 전 최종 통합 지점에서 한 번만 실행한다.
- `npm run test:e2e`가 production build를 포함하므로 같은 tree에서 `npm run build`를 별도로 중복 실행하지 않는다.
- fast-forward merge처럼 검증한 commit과 병합 결과 tree가 같으면 전체 suite를 다시 실행하지 않는다. commit/tree 동일성, status와 필요한 최소 smoke만 확인한다.
- 문서만 변경한 경우 코드 test를 다시 실행하지 않고 `git diff --check`, 링크와 내용 정합성만 확인한다.
- 실패가 발생하면 전체 suite를 반복하지 말고 실패 test나 관련 spec으로 범위를 좁혀 수정한 뒤, milestone gate에서 전체 검증한다.
- Modal actual, GPU, 외부 AI/media 검증은 해당 경계를 변경했고 사용자가 명시적으로 승인한 경우에만 실행한다.
- schema migration, build 설정, runtime dependency처럼 영향 범위가 넓은 변경은 필요한 추가 gate를 실행할 수 있으며 이유를 기록한다.
- 완료 보고에는 현재 tree에 유효한 최신 검증 결과를 사용한다. 검증 뒤 source가 바뀌지 않았다면 보고 직전 동일 명령을 재실행하지 않는다.
