import json
import logging
import threading
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("sentinel_ai")


class Sentinel:
    """
    Sentinel AI Python Client for LLM Observability and Tracing.
    Non-blocking, resilient event ingestion designed for production AI systems.
    """

    def __init__(
        self,
        api_key: str,
        project_id: Optional[str] = None,
        base_url: str = "http://localhost:8000",
        timeout: float = 5.0,
        async_dispatch: bool = False,
    ):
        self.api_key = api_key.strip()
        self.project_id = project_id
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.async_dispatch = async_dispatch
        self.ingest_url = f"{self.base_url}/api/v1/traces/ingest"

    def _send_payload(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(self.ingest_url, json=payload, headers=headers)
                if resp.status_code == 201:
                    return resp.json()
                else:
                    logger.warning(
                        f"[Sentinel AI] Ingestion rejected with status {resp.status_code}: {resp.text}"
                    )
        except Exception as e:
            logger.error(f"[Sentinel AI] Failed to transmit trace event: {e}")
        return None

    def log_event(
        self,
        model: str,
        operation: str = "generation",
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        status: str = "success",
        name: str = "llm_request",
        provider: str = "custom",
        input_payload: Optional[str] = None,
        output_payload: Optional[str] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        spans: Optional[List[Dict[str, Any]]] = None,
        estimated_cost: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Log an LLM event or trace to the Sentinel AI platform.
        """
        payload = {
            "name": name,
            "operation_type": operation,
            "model": model,
            "provider": provider,
            "status": status,
            "latency_ms": latency_ms,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost": estimated_cost,
            "input_payload": input_payload,
            "output_payload": output_payload,
            "error_message": error_message,
            "metadata": metadata,
            "spans": spans,
        }

        if self.async_dispatch:
            t = threading.Thread(target=self._send_payload, args=(payload,), daemon=True)
            t.start()
            return {"status": "dispatched_async"}

        return self._send_payload(payload)

    def log_trace(self, **kwargs) -> Optional[Dict[str, Any]]:
        """Alias for log_event."""
        return self.log_event(**kwargs)
