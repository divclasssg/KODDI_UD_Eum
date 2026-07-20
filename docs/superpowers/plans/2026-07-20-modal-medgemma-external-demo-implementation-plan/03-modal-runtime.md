> [상위 계획](../2026-07-20-modal-medgemma-external-demo-implementation-plan.md)

### Task 3: Modal quota gate와 MedGemma GPU 함수

**Files:**
- Create: `inference/__init__.py`
- Create: `inference/modal_medgemma/__init__.py`
- Create: `inference/modal_medgemma/schemas.py`
- Create: `inference/modal_medgemma/prompts.py`
- Create: `inference/modal_medgemma/quota.py`
- Create: `inference/modal_medgemma/quota_smoke_app.py`
- Create: `inference/modal_medgemma/medgemma_app.py`
- Create: `inference/modal_medgemma/requirements-dev.txt`
- Test: `tests/modal/test_schemas.py`
- Test: `tests/modal/test_quota.py`
- Test: `tests/modal/test_prompts.py`

**Endpoint request:**

```py
class InferenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["question", "summary"]
    context: AiInterviewContextV1
    session_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    ip_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
```

- [ ] **Step 1: 순수 Python schema·quota·prompt 테스트를 작성한다**

UTC minute/hour/day bucket, 경계 직전·직후, session 6번째, IP 21번째, daily 101번째, unknown field와 prompt의 진단·치료 금지 문장을 검증한다. quota 함수는 현재 시각을 인자로 받아 결정론적으로 테스트한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `python3 -m pip install -r inference/modal_medgemma/requirements-dev.txt && python3 -m pytest tests/modal`

Expected: 대상 module not found로 FAIL. 설치는 사용자가 dependency 설치를 승인한 실행 세션에서만 한다.

- [ ] **Step 3: Modal Dict quota 저장 형식을 구현한다**

```py
@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    code: Literal["ok", "session-minute", "ip-hour", "actual-day"]

def reserve_quota(store: MutableMapping[str, int], now: datetime,
                  session_hash: str, ip_hash: str) -> QuotaDecision: ...
```

key는 `s:<minute>:<session_hash>`, `i:<hour>:<ip_hash>`, `d:<day>` 형식이다. 값에는 문진 payload를 넣지 않는다. CPU gate를 `max_containers=1`·`@modal.concurrent(max_inputs=1)`로 직렬화하므로 read-modify-write가 동시에 실행되지 않는다.

- [ ] **Step 4: 모델 image와 GPU class를 구현한다**

Python 3.12 image와 `modal==1.5.2`, `torch==2.13.0`, `transformers==5.14.1`, `accelerate==1.14.0`, `fastapi==0.139.2`, `pydantic==2.13.4`, `huggingface-hub==1.3.4`를 고정한다. 개발 요구사항에는 `pytest==9.1.1`을 고정한다. Modal image build function에서 gated model을 image layer에 내려받아 cold start 네트워크 다운로드를 없애며 `HF_TOKEN`은 `modal.Secret.from_name("medgemma-hf")`로만 주입한다.

`@modal.enter()`에서 `AutoProcessor`와 `AutoModelForImageTextToText`를 float16으로 T4에 1회 로드한다. `generate`는 `do_sample=False`, `max_new_tokens=384`(질문) 또는 `768`(요약)이며 반환은 model text뿐이다. 로그에는 kind, latency, validator code만 기록한다.

- [ ] **Step 5: 인증된 CPU gate를 구현한다**

```py
@app.function(max_containers=1)
@modal.concurrent(max_inputs=1)
@modal.fastapi_endpoint(requires_proxy_auth=True, docs=False)
def infer(request: InferenceRequest) -> dict[str, object]: ...
```

gate는 Pydantic 검증 → Dict quota 예약 → GPU `generate.remote()` 순서만 허용한다. quota 초과는 GPU 호출 없이 429, 비활성 kill switch는 503, schema 오류는 400으로 일반화한다. GPU 함수는 `gpu="T4"`, `min_containers=0`, `max_containers=1`, `scaledown_window=60`, `timeout=60`으로 시작한다.

`quota_smoke_app.py`는 같은 `reserve_quota`를 호출하지만 GPU 함수와 모델 secret을 포함하지 않는 인증 test app(`medgemma-quota-smoke`)이다. 운영 app에서 import하거나 배포하지 않는다.

- [ ] **Step 6: Python 검증 후 멈춘다**

Run: `python3 -m pytest tests/modal`

Expected: 모두 PASS. Modal deploy·commit·push하지 않는다.
