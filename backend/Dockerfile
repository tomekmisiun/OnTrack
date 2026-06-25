# Self-contained backend image — build context MUST be backend/
# See docs/backend-migration/DATA_DEPLOYMENT_ROADMAP.md
FROM python:3.11-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts
COPY data ./data
RUN chmod +x scripts/*.sh

EXPOSE 8000

CMD ["scripts/start-production.sh"]
