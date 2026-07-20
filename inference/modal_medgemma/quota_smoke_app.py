from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import modal
from pydantic import ValidationError

from .quota import reserve_quota
from .schemas import InferenceRequest


runtime_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi==0.139.2", "pydantic==2.13.4")
    .add_local_python_source("inference")
)

app = modal.App("medgemma-quota-smoke")
quota_store = modal.Dict.from_name(
    "medgemma-quota-smoke",
    create_if_missing=True,
)


@app.function(
    image=runtime_image,
    min_containers=0,
    max_containers=1,
    timeout=10,
)
@modal.concurrent(max_inputs=1)
@modal.fastapi_endpoint(
    method="POST",
    requires_proxy_auth=True,
    docs=False,
)
def reserve(payload: dict[str, Any]) -> dict[str, object]:
    from fastapi import HTTPException

    try:
        request = InferenceRequest.model_validate(payload)
    except ValidationError:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid-request"},
        ) from None

    decision = reserve_quota(
        quota_store,
        datetime.now(timezone.utc),
        request.session_hash,
        request.ip_hash,
    )
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail={"code": decision.code},
        )
    return {"allowed": True, "code": decision.code}
