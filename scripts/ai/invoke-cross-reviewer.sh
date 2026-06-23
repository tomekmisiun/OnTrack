#!/usr/bin/env bash
# Invoke a read-only advisory Reviewer for the current uncommitted diff.
#
# Usage:
#   scripts/ai/invoke-cross-reviewer.sh <claude|codex> [handoff-file]
#
# Optional configuration (repository root or environment):
#   .ai-review.env  — sourceable shell assignments (not committed with secrets)
#
# Environment variables:
#   AI_REVIEW_MODEL, CLAUDE_REVIEW_MODEL, CODEX_REVIEW_MODEL, AI_REVIEW_TIER
#
# The invoked CLI is run read-only (claude: --permission-mode plan, codex:
# global -s read-only -a never).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PROVIDER="${1:-}"
HANDOFF_FILE="${2:-}"

usage() {
  cat >&2 <<'EOF'
Usage: scripts/ai/invoke-cross-reviewer.sh <claude|codex> [handoff-file]

Runs a read-only advisory review of the current diff:
  - claude : Claude Code CLI (claude -p --permission-mode plan)
  - codex  : native Codex review (global -s read-only -a never,
             review --uncommitted)

[handoff-file] is an optional path to a filled-in Builder handoff
(.commands/builder-handoff.md format).

Configuration:
  - Export AI_REVIEW_MODEL for an absolute model override.
  - Export CLAUDE_REVIEW_MODEL or CODEX_REVIEW_MODEL for provider overrides.
  - Export AI_REVIEW_TIER to document tier intent (see .ai-rules/model-routing.md).
  - Optionally create .ai-review.env in the repository root (see examples/).

This script never selects a provider automatically. You must pass claude or codex.
It exits non-zero when the chosen CLI is missing or the review fails.

On failure, fall back according to .ai-rules/agent-orchestration.md.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$PROVIDER" != "claude" && "$PROVIDER" != "codex" ]]; then
  usage
  exit 2
fi

if [[ -f "$ROOT/.ai-review.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.ai-review.env"
fi

REQUIRED_FILES=(
  ".ai-rules/review-checklist.md"
  ".commands/builder-handoff.md"
)
for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "invoke-cross-reviewer: missing required file: $f" >&2
    exit 1
  fi
done

if [[ -n "$HANDOFF_FILE" && ! -f "$HANDOFF_FILE" ]]; then
  echo "invoke-cross-reviewer: handoff file not found: $HANDOFF_FILE" >&2
  exit 1
fi

if ! command -v "$PROVIDER" >/dev/null 2>&1; then
  echo "invoke-cross-reviewer: '$PROVIDER' CLI not found on PATH." >&2
  echo "invoke-cross-reviewer: fall back according to" \
       ".ai-rules/agent-orchestration.md." >&2
  exit 1
fi

AI_REVIEW_TIER="${AI_REVIEW_TIER:-strong_reviewer}"

resolve_review_model() {
  local provider="$1"
  if [[ -n "${AI_REVIEW_MODEL:-}" ]]; then
    REVIEW_MODEL="$AI_REVIEW_MODEL"
    echo "Using AI_REVIEW_MODEL=$REVIEW_MODEL for provider=$provider." >&2
    return
  fi
  if [[ "$provider" == "claude" && -n "${CLAUDE_REVIEW_MODEL:-}" ]]; then
    REVIEW_MODEL="$CLAUDE_REVIEW_MODEL"
    echo "Using CLAUDE_REVIEW_MODEL=$REVIEW_MODEL." >&2
    return
  fi
  if [[ "$provider" == "codex" && -n "${CODEX_REVIEW_MODEL:-}" ]]; then
    REVIEW_MODEL="$CODEX_REVIEW_MODEL"
    echo "Using CODEX_REVIEW_MODEL=$REVIEW_MODEL." >&2
    return
  fi
  REVIEW_MODEL=""
  echo "No model override set (AI_REVIEW_TIER=$AI_REVIEW_TIER); using CLI default model." >&2
  echo "Configure AI_REVIEW_MODEL or provider-specific overrides — see docs/CROSS_PROVIDER_REVIEW.md." >&2
}

resolve_review_model "$PROVIDER"

build_claude_prompt() {
  echo "# Cross-provider read-only review request"
  echo
  echo "You are an external, read-only Reviewer for this repository."
  echo
  echo "## Hard rules"
  echo "- Review only. Do NOT edit, create, move, or delete any files."
  echo "- Do NOT run destructive or mutating commands."
  echo "- Diff-first review from git output below."
  echo "- Output MUST use section headings from .ai-rules/review-checklist.md."
  echo
  echo "## Review context"
  echo "- AI_REVIEW_TIER: $AI_REVIEW_TIER"
  echo "- Reviewer model: ${REVIEW_MODEL:-<CLI default model>}"
  echo
  echo "## Review checklist (.ai-rules/review-checklist.md)"
  echo '```markdown'
  cat "$ROOT/.ai-rules/review-checklist.md"
  echo '```'
  echo
  if [[ -n "$HANDOFF_FILE" ]]; then
    echo "## Builder handoff (filled in)"
    echo '```markdown'
    cat "$HANDOFF_FILE"
    echo '```'
    echo
  fi
  echo "## git status --short"; echo '```'; git status --short; echo '```'; echo
  echo "## git diff --stat"; echo '```'; git diff --stat; echo '```'; echo
  echo "## git diff"; echo '```diff'; git diff; echo '```'; echo
  echo "## git diff --cached"; echo '```diff'; git diff --cached; echo '```'
}

OUTPUT=""
STATUS=0

case "$PROVIDER" in
  claude)
    if ! claude -p --help >/dev/null 2>&1; then
      echo "invoke-cross-reviewer: 'claude -p' is not available." >&2
      exit 1
    fi
    MODEL_ARGS=()
    if [[ -n "$REVIEW_MODEL" ]]; then
      MODEL_ARGS=(--model "$REVIEW_MODEL")
    fi
    PROMPT_FILE="$(mktemp)"
    trap 'rm -f "$PROMPT_FILE"' EXIT
    build_claude_prompt > "$PROMPT_FILE"
    set +e
    OUTPUT="$(claude -p --permission-mode plan --output-format text \
      "${MODEL_ARGS[@]}" < "$PROMPT_FILE")"
    STATUS=$?
    set -e
    ;;
  codex)
    if ! codex review --help >/dev/null 2>&1; then
      echo "invoke-cross-reviewer: 'codex review' is not available." >&2
      exit 1
    fi
    CODEX_GLOBAL_ARGS=(-s read-only -a never)
    if [[ -n "$REVIEW_MODEL" ]]; then
      CODEX_GLOBAL_ARGS+=(-m "$REVIEW_MODEL")
    fi
    set +e
    OUTPUT="$(codex "${CODEX_GLOBAL_ARGS[@]}" review --uncommitted)"
    STATUS=$?
    set -e
    ;;
esac

if [[ "$STATUS" -ne 0 ]]; then
  echo "invoke-cross-reviewer: '$PROVIDER' invocation failed (exit $STATUS)." >&2
  exit 1
fi

printf '%s\n' "$OUTPUT"

if [[ "$PROVIDER" == "claude" ]]; then
  REQUIRED_HEADINGS=(
    "## Blockers"
    "## Should-fix"
    "## Nice-to-have"
    "## Validation concerns"
    "## Security/production risks"
    "## Overengineering/scope creep"
    "## Final verdict"
  )
  missing=0
  for heading in "${REQUIRED_HEADINGS[@]}"; do
    if ! grep -qF "$heading" <<<"$OUTPUT"; then
      echo "invoke-cross-reviewer: WARNING: missing section: $heading" >&2
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
fi
