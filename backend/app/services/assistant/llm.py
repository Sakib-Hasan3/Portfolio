"""Server-side OpenAI-compatible chat client (Groq by default). Keys come from the environment only."""

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx

from app.core.config import settings

log = logging.getLogger("assistant.llm")

PROVIDERS = {
    "groq": ("https://api.groq.com/openai/v1", lambda: settings.GROQ_API_KEY),
    "openai": ("https://api.openai.com/v1", lambda: settings.OPENAI_API_KEY),
    "custom": (None, lambda: settings.LLM_API_KEY),
}


class LLMUnavailable(Exception):
    """Provider missing, misconfigured, timed out or returned an error."""


@dataclass
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0


def provider_config(provider: str) -> tuple[str, str]:
    base, key_fn = PROVIDERS.get(provider, PROVIDERS["groq"])
    base = base or settings.LLM_BASE_URL
    key = key_fn()
    if not base or not key:
        raise LLMUnavailable(f"LLM provider '{provider}' is not configured")
    return base.rstrip("/"), key


def llm_configured(provider: str) -> bool:
    try:
        provider_config(provider)
        return True
    except LLMUnavailable:
        return False


async def stream_chat(
    *, provider: str, model: str, messages: list[dict], temperature: float, max_tokens: int, usage: Usage
) -> AsyncIterator[str]:
    base, key = provider_config(provider)
    payload = {
        "model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens,
        "stream": True, "stream_options": {"include_usage": True},
    }
    timeout = httpx.Timeout(settings.ASSISTANT_LLM_TIMEOUT_SECONDS, connect=6.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", f"{base}/chat/completions", json=payload, headers={"Authorization": f"Bearer {key}"}
            ) as resp:
                if resp.status_code >= 400:
                    body = (await resp.aread())[:300].decode("utf-8", "replace")
                    log.warning("LLM provider returned %s: %s", resp.status_code, body)
                    raise LLMUnavailable(f"provider status {resp.status_code}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        evt = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if u := evt.get("usage"):
                        usage.prompt_tokens = u.get("prompt_tokens", usage.prompt_tokens)
                        usage.completion_tokens = u.get("completion_tokens", usage.completion_tokens)
                    for choice in evt.get("choices") or []:
                        piece = (choice.get("delta") or {}).get("content")
                        if piece:
                            yield piece
    except httpx.HTTPError as exc:
        log.warning("LLM request failed: %s", type(exc).__name__)
        raise LLMUnavailable(type(exc).__name__) from exc
