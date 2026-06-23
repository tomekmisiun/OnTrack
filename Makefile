.PHONY: validate validate-ai-workflows test

validate: validate-ai-workflows

validate-ai-workflows:
	bash scripts/validate-ai-workflows.sh

test:
	pytest tests/ -v
