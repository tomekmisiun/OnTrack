.PHONY: validate validate-ai-workflows test

validate: validate-ai-workflows

validate-ai-workflows:
	bash scripts/validate-ai-workflows.sh

test:
	cd backend && uv run pytest tests/contract/ tests/test_health.py tests/test_dish_compare_data.py -q
