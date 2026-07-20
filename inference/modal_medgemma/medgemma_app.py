from __future__ import annotations

import logging
import os
from collections.abc import Callable, MutableMapping
from datetime import datetime, timezone
from time import monotonic
from typing import Any

import modal
from pydantic import ValidationError

from .prompts import build_prompt
from .quota import reserve_quota
from .schemas import AiInterviewContextV1, InferenceRequest


MODEL_ID = "google/medgemma-1.5-4b-it"
MODEL_DIR = "/models/medgemma-1.5-4b-it"
MODEL_PYTHON_VERSION = "3.12"
MODEL_IMAGE_PACKAGES = (
    "modal==1.5.2",
    "torch==2.13.0",
    "transformers==5.14.1",
    "accelerate==1.14.0",
    "fastapi==0.139.2",
    "pydantic==2.13.4",
    "huggingface-hub==1.3.4",
)
GPU_TYPE = "T4"
GPU_MIN_CONTAINERS = 0
GPU_MAX_CONTAINERS = 1
GPU_SCALEDOWN_WINDOW = 60
GPU_TIMEOUT = 60
QUESTION_MAX_NEW_TOKENS = 384
SUMMARY_MAX_NEW_TOKENS = 768

LOGGER = logging.getLogger(__name__)


class GateRejected(Exception):
    def __init__(self, status_code: int, code: str) -> None:
        super().__init__(f"Modal gate rejected: {code}")
        self.status_code = status_code
        self.code = code


def execute_gate(
    payload: object,
    store: MutableMapping[str, int],
    now: datetime,
    *,
    actual_enabled: bool,
    generate: Callable[[str, dict[str, object]], str],
) -> dict[str, str]:
    try:
        request = InferenceRequest.model_validate(payload)
    except ValidationError:
        raise GateRejected(400, "invalid-request") from None

    if not actual_enabled:
        raise GateRejected(503, "actual-disabled")

    decision = reserve_quota(
        store,
        now,
        request.session_hash,
        request.ip_hash,
    )
    if not decision.allowed:
        raise GateRejected(429, decision.code)

    context = request.context.model_dump(by_alias=True, exclude_none=True)
    try:
        text = generate(request.kind, context)
    except Exception:
        raise GateRejected(503, "generation-failed") from None
    if not isinstance(text, str) or not text.strip():
        raise GateRejected(503, "invalid-model-output")
    return {"text": text.strip()}


def download_model(model_id: str, model_dir: str) -> None:
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id=model_id,
        local_dir=model_dir,
        token=os.environ["HF_TOKEN"],
    )


runtime_image = (
    modal.Image.debian_slim(python_version=MODEL_PYTHON_VERSION)
    .pip_install("fastapi==0.139.2", "pydantic==2.13.4")
    .add_local_python_source("inference")
)

model_image = (
    modal.Image.debian_slim(python_version=MODEL_PYTHON_VERSION)
    .pip_install(*MODEL_IMAGE_PACKAGES)
    .run_function(
        download_model,
        args=(MODEL_ID, MODEL_DIR),
        secrets=[modal.Secret.from_name("medgemma-hf")],
    )
    .add_local_python_source("inference")
)

app = modal.App("medgemma-external-demo")
quota_store = modal.Dict.from_name("medgemma-demo-quota", create_if_missing=True)


@app.cls(
    image=model_image,
    gpu=GPU_TYPE,
    min_containers=GPU_MIN_CONTAINERS,
    max_containers=GPU_MAX_CONTAINERS,
    scaledown_window=GPU_SCALEDOWN_WINDOW,
    timeout=GPU_TIMEOUT,
)
class MedGemmaModel:
    @modal.enter()
    def load(self) -> None:
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        self.processor = AutoProcessor.from_pretrained(
            MODEL_DIR,
            local_files_only=True,
        )
        self.model = AutoModelForImageTextToText.from_pretrained(
            MODEL_DIR,
            dtype=torch.float16,
            device_map="auto",
            local_files_only=True,
        )

    @modal.method()
    def generate(self, kind: str, context: dict[str, object]) -> str:
        import torch

        validated_context = AiInterviewContextV1.model_validate(context)
        prompt = build_prompt(kind, validated_context)
        messages = [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}],
            }
        ]
        inputs = self.processor.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self.model.device)
        input_length = inputs["input_ids"].shape[-1]
        max_new_tokens = (
            QUESTION_MAX_NEW_TOKENS
            if kind == "question"
            else SUMMARY_MAX_NEW_TOKENS
        )
        with torch.inference_mode():
            output = self.model.generate(
                **inputs,
                do_sample=False,
                max_new_tokens=max_new_tokens,
            )
        generated = output[0][input_length:]
        return self.processor.decode(generated, skip_special_tokens=True).strip()


model = MedGemmaModel()


@app.function(
    image=runtime_image,
    secrets=[modal.Secret.from_name("medgemma-runtime")],
    min_containers=0,
    max_containers=1,
    timeout=65,
)
@modal.concurrent(max_inputs=1)
@modal.fastapi_endpoint(
    method="POST",
    requires_proxy_auth=True,
    docs=False,
)
def infer(payload: dict[str, Any]) -> dict[str, object]:
    from fastapi import HTTPException

    started = monotonic()
    safe_kind = payload.get("kind")
    if safe_kind not in ("question", "summary"):
        safe_kind = "invalid"
    try:
        result = execute_gate(
            payload,
            quota_store,
            datetime.now(timezone.utc),
            actual_enabled=(
                os.environ.get("MEDGEMMA_ACTUAL_DISABLED", "1") == "0"
            ),
            generate=lambda kind, context: model.generate.remote(kind, context),
        )
    except GateRejected as error:
        elapsed_ms = int((monotonic() - started) * 1_000)
        LOGGER.info(
            "kind=%s latency_ms=%d validator=%s",
            safe_kind,
            elapsed_ms,
            error.code,
        )
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code},
        ) from None

    elapsed_ms = int((monotonic() - started) * 1_000)
    LOGGER.info(
        "kind=%s latency_ms=%d validator=ok",
        safe_kind,
        elapsed_ms,
    )
    return result
