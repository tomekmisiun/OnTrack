"""Optional Sentry integration — active only when SENTRY_DSN is set."""

from __future__ import annotations

from app.core.config import Settings


def init_sentry(settings: Settings) -> None:
    dsn = (settings.sentry_dsn or "").strip()
    if not dsn:
        return

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    environment = settings.sentry_environment or ("development" if settings.debug else "production")

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
    )
