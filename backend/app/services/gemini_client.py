"""Shared Gemini API helpers for receipt and recipe parsing."""

import time

GEMINI_PARSE_MODELS = ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash")


def is_gemini_overloaded(err: Exception) -> bool:
    msg = str(err).lower()
    return any(
        x in msg
        for x in (
            "503",
            "unavailable",
            "high demand",
            "429",
            "resource exhausted",
            "overloaded",
        )
    )


def generate_with_gemini(client, contents, *, system_instruction: str | None = None) -> str:
    from google.genai import types

    config = None
    if system_instruction:
        config = types.GenerateContentConfig(system_instruction=system_instruction)

    last_err = None
    for model in GEMINI_PARSE_MODELS:
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                )
                return response.text
            except Exception as e:
                last_err = e
                if is_gemini_overloaded(e) and attempt == 0:
                    time.sleep(1.5)
                    continue
                if not is_gemini_overloaded(e):
                    raise
                break
    raise last_err
