> [상위 문서](../2026-07-20-modal-medgemma-external-demo-design.md)

# Modal 런타임·보안·검증

## 1. Modal 배포 계약

- 모델: `google/medgemma-1.5-4b-it`
- 실행: Modal custom App의 인증된 HTTPS endpoint
- 최초 GPU 후보: NVIDIA T4 1개
- GPU 승격: T4에서 메모리 부족, warm response 15초 초과 또는 cold response 60초 초과가 반복되면 L4 1개로 변경
- autoscaling: `min_containers=0`, `max_containers=1`, 초기 scale-down window 60초
- 모델 파일: 배포 Image 또는 승인된 model cache에 준비해 cold start 다운로드를 피함
- Hugging Face: 모델 약관을 승인한 전용 fine-grained read token을 Modal Secret으로 주입
- 로그: 입력·출력, prompt, 증상, 질문과 요약 본문 기록 금지

공개 Next.js 호스트와 GPU 사이에는 인증된 Modal CPU gate를 둔다. CPU gate는 `max_containers=1`, 동시 입력 1개로 직렬화하고 영속 Modal Dict에서 session·IP·일일 quota를 예약한 뒤에만 GPU 함수를 호출한다. Dict에는 HMAC 식별자와 시간 bucket별 숫자만 저장하고 문진 payload는 저장하지 않는다.

Modal endpoint는 무인증 공개 모드로 배포하지 않는다. Next.js Route Handler만 Modal 인증 헤더를 추가할 수 있다. Modal Starter credit은 가용하면 사용하지만 무료를 완료 조건으로 삼지 않는다.

## 2. 공개 익명 데모 보안

- 로그인과 접근 코드는 사용하지 않는다.
- 서버는 개인을 식별하지 않는 임시 익명 session cookie를 발급한다.
- cookie는 `Secure`, `HttpOnly`, `SameSite=Lax`로 설정하고 장기 사용자 ID로 재사용하지 않는다.
- 허용된 공개 웹 Origin의 `POST`와 JSON content type만 허용한다.
- 요청 body 크기, turn 수, 동시 요청과 session·IP별 요청 빈도를 제한한다.
- 초기 상한은 session당 분당 5회, IP당 시간당 20회, 전체 일일 actual 요청 100회다.
- IP 정보는 짧은 rate-limit window에만 사용하고 문진 데이터와 결합하거나 장기 보관하지 않는다.
- 일일 상한 초과나 이상 사용량 발생 시 actual provider를 끄고 수동 문진으로 전환하는 server-side kill switch를 둔다.
- session별 단일 active AI 요청만 허용한다.
- navigation, reset과 동의 철회 시 요청을 abort하고 늦은 응답을 폐기한다.
- raw Modal·Transformers 오류를 client에 노출하지 않는다.
- provider/model, latency, validator 결과, retry·fallback 여부만 운영 지표로 기록한다.
- 실제 데이터 입력 금지와 비진단·비치료 고지를 항상 표시한다.
- 역할극 확인 전 actual 요청을 금지하고 자유 입력 가까이에 같은 경고를 반복한다.
- client 식별정보 검사 실패는 네트워크 전에 차단하고 server가 동일 규칙을 재검사한다.
- 마이크·녹음·실제 STT API를 호출하지 않는다.

실제 환자 데이터 허용은 이 설계 범위를 벗어난다. Modal Enterprise BAA, 국외 이전, 보존·삭제, 접근통제와 의료 규제 검토를 포함한 새 승인이 필요하다.

## 3. Cold start와 오류 처리

기본 요청 deadline은 60초다. cold start와 warm response를 구분해 측정하며 화면에는 단계 수 대신 `다음 질문을 준비하고 있어요`를 표시한다.

1. `429`, `503`과 일시적 transport 오류만 최대 1회 재시도한다.
2. `401`, `403`, schema 오류와 금지 출력은 재시도하지 않는다.
3. deadline 초과, 반복 오류와 잘못된 출력은 수동 질문으로 전환한다.
4. 저장된 답변을 유지하고 AI 요청만 다시 시도할 수 있게 한다.
5. 요약 실패 시 versioned deterministic summary로 완주한다.

공개 warmup endpoint는 만들지 않는다. 사용자가 문진 시작을 명시했을 때만 인증된 준비 요청을 보낼 수 있으며 actual gate에서 비용과 abuse 위험을 확인한 뒤 활성화한다.

## 4. 비용 계약

- `max_containers=1`로 비용 폭증을 제한한다.
- 고정 warm container는 기본적으로 사용하지 않는다.
- 활성 GPU 시간, cold start 횟수와 요청당 비용을 payload 없이 측정한다.
- 월 $30을 초기 목표 상한으로 두고 도달 시 사용자가 재승인할 때까지 actual provider를 중단한다.
- Modal Workspace budget을 월 $30 하드 캡으로 설정해 애플리케이션 kill switch 실패와 별개로 비용 상한을 강제한다.
- T4에서 시작하며 검증 근거 없이 L4·A10 이상으로 올리지 않는다.

## 5. 자동 검증

- mock provider 질문·요약 happy path
- Modal adapter 인증 헤더와 payload allowlist
- unknown field, 식별정보, oversize, turn limit 거절
- client·server 식별정보 검사와 Modal 요청 미발생
- `401`, `403`, `429`, `503`, timeout과 invalid JSON mapping
- 1회 재시도, manual fallback, abort, stale·duplicate 차단
- request·response body 비로그 검사
- Origin allowlist, session·IP rate limit과 일일 kill switch
- 모의 음성 입력의 listening·transcribing·transcript 상태 전환
- 모의 음성 입력 중 마이크 권한·녹음·STT 요청 미발생
- 승인 slot이 없을 때 텍스트·선택형 입력으로 전환

## 6. Actual gate

- 세 합성 Persona 각각 cold 1회와 warm 2회 질문 성공
- 세 Persona 각각 요약 1회 성공
- 역할극 확인 전 actual 요청이 발생하지 않음
- 역할극 자유 입력과 직접 식별정보 차단이 함께 동작함
- 세 Persona의 모의 음성 transcript가 현재 질문 slot과 일치함
- 질문이 한 문장·한 의도·쉬운 한국어 validator 통과
- 질문 수가 고정 단계로 표시되지 않음
- 질문·요약이 versioned schema 통과
- cold 60초, warm 15초 안에 응답
- 실패 시 답변을 유지하고 수동 흐름으로 완주
- 운영 증거에 prompt·답변·질문·요약 본문이 없음
