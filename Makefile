.PHONY: validate validate-ai-workflows test test-backend test-frontend test-integration

BACKEND := backend
PYTEST := $(shell command -v uv >/dev/null 2>&1 && echo "uv run pytest" || echo ".venv/bin/pytest")

validate: validate-ai-workflows

validate-ai-workflows:
	bash scripts/validate-ai-workflows.sh

# Same pytest paths as the CI `test` job
test:
	cd $(BACKEND) && $(PYTEST) tests/contract/ \
		tests/test_health.py tests/test_dish_compare_data.py tests/test_catalog_pipeline.py -q

# All backend tests that do not require external PostgreSQL (excludes tests/integration/)
test-backend:
	cd $(BACKEND) && $(PYTEST) --ignore=tests/integration -q

test-frontend:
	cd frontend-next && npm run test

# Postgres migration rehearsal — requires TEST_DATABASE_URL (see docs/TESTING.md)
test-integration:
	cd $(BACKEND) && $(PYTEST) tests/integration/ -v --maxfail=1
