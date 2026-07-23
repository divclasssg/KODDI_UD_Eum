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

- [x] **Step 1: 순수 Python schema·quota·prompt 테스트를 작성한다**

UTC minute/hour/day bucket, 경계 직전·직후, session 6번째, IP 21번째, daily 101번째, unknown field와 prompt의 진단·치료 금지 문장을 검증한다. quota 함수는 현재 시각을 인자로 받아 결정론적으로 테스트한다.

- [x] **Step 2: 실패를 확인한다**

Run: `python3 -m pip install -r inference/modal_medgemma/requirements-dev.txt && python3 -m pytest tests/modal`

Expected: 대상 module not found로 FAIL. 설치는 사용자가 dependency 설치를 승인한 실행 세션에서만 한다.

- [x] **Step 3: Modal Dict quota 저장 형식을 구현한다**

```py
@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    code: Literal["ok", "session-minute", "ip-hour", "actual-day"]

def reserve_quota(store: MutableMapping[str, int], now: datetime,
                  session_hash: str, ip_hash: str) -> QuotaDecision: ...
```

key는 `s:<minute>:<session_hash>`, `i:<hour>:<ip_hash>`, `d:<day>` 형식이다. 값에는 문진 payload를 넣지 않는다. CPU gate를 `max_containers=1`·`@modal.concurrent(max_inputs=1)`로 직렬화하므로 read-modify-write가 동시에 실행되지 않는다.

- [x] **Step 4: 모델 image와 GPU class를 구현한다**

Python 3.12 image와 `modal==1.5.2`, `torch==2.13.0`, `torchvision==0.28.0`, `transformers==5.14.1`, `accelerate==1.14.0`, `fastapi==0.139.2`, `pydantic==2.13.4`, `huggingface-hub==1.5.0`, `pillow==12.3.0`, `bitsandbytes==0.49.2`를 고정한다. 개발 요구사항에는 `pytest==9.1.1`을 고정한다. Modal image build function에서 gated model을 image layer에 내려받아 cold start 네트워크 다운로드를 없애며 `HF_TOKEN`은 `modal.Secret.from_name("medgemma-hf")`로만 주입한다. `huggingface-hub`은 `transformers==5.14.1`의 `>=1.5.0,<2.0` 계약에 맞추고, `torchvision`과 Pillow는 MedGemma multimodal processor 초기화에 사용한다. `bitsandbytes`는 T4의 8비트 선형 가중치 검증에 사용한다.

`@modal.enter()`에서 `AutoProcessor`와 `AutoModelForImageTextToText`를 `BitsAndBytesConfig(load_in_8bit=True)`와 float32 잔여 연산으로 T4에 1회 로드한다. float16은 첫 forward의 전체 logits가 NaN이 되어 사용하지 않는다. 질문은 assistant prefill로 `slot`·`text`만 최대 64토큰 생성하고 런타임이 version·kind·id·selection·option을 고정 조립한다. 요약도 assistant prefill로 짧은 `text`만 최대 64토큰 생성하며 런타임이 version·section·실제 context turn evidence ID를 조립한다. 모든 slot이 채워진 질문은 생성 없이 `complete`를 반환한다. 로그에는 payload 없이 생성 token 수와 latency·오류 유형만 기록한다.

Modal Secret `medgemma-hf`에는 image build 전용 `HF_TOKEN`만 둔다. CPU gate의 별도 Secret `medgemma-runtime`에는 `MEDGEMMA_ACTUAL_DISABLED=1|0`만 두며 GPU 함수에는 주입하지 않는다.

- [x] **Step 5: 인증된 CPU gate를 구현한다**

```py
@app.function(max_containers=1)
@modal.concurrent(max_inputs=1)
@modal.fastapi_endpoint(requires_proxy_auth=True, docs=False)
def infer(request: InferenceRequest) -> dict[str, object]: ...
```

gate는 Pydantic 검증 → Dict quota 예약 → GPU `generate.remote()` 순서만 허용한다. quota 초과는 GPU 호출 없이 429, 비활성 kill switch는 503, schema 오류는 400으로 일반화한다. GPU 함수는 `gpu="T4"`, `min_containers=0`, `max_containers=1`, `scaledown_window=60`, `timeout=60`을 유지한다. scale-to-zero cold start를 수용하는 비용 우선 계약으로 CPU web 함수 timeout은 180초, Next provider 기본 timeout은 75초·허용 상한은 180초로 둔다.

`quota_smoke_app.py`는 같은 `reserve_quota`를 호출하지만 GPU 함수와 모델 secret을 포함하지 않는 인증 test app(`medgemma-quota-smoke`)이다. 운영 app에서 import하거나 배포하지 않는다.

FastAPI가 typed body 오류를 기본 422로 반환하는 동작과 승인된 400 계약이 충돌하므로 endpoint는 raw object를 받은 직후 `InferenceRequest.model_validate()`를 직접 실행한다. 그 뒤에만 kill switch·quota 예약·GPU 호출로 진행한다.

- [x] **Step 6: Python 검증 후 멈춘다**

Run: `python3 -m pytest tests/modal`

Expected: 모두 PASS. Modal deploy·commit·push하지 않는다.
