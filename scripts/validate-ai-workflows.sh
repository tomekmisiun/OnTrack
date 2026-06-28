#!/usr/bin/env bash
# Static validation for AI workflow files. Does not invoke external AI CLIs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

missing=0
warn=0

fail() {
  echo "validate-ai-workflows: $1" >&2
  missing=1
}

warn_msg() {
  echo "validate-ai-workflows: WARNING: $1" >&2
  warn=1
}

required_ai_rules=(
  agent-orchestration.md
  anti-overengineering.md
  architecture.md
  context-map.md
  documentation.md
  git.md
  incremental-work.md
  learning-mode.md
  model-routing.md
  planning-and-task-breakdown.md
  repository.md
  review-checklist.md
  review.md
  security.md
  spec-driven-development.md
  tdd-and-regression.md
  testing.md
  threat-modeling.md
  validation.md
)

for rule in "${required_ai_rules[@]}"; do
  if [[ ! -f "$ROOT/.ai-rules/$rule" ]]; then
    fail "missing universal rule: .ai-rules/$rule"
  fi
done

required_files=(
  AGENTS.md
  CLAUDE.md
  docs/ai-workflows.md
  docs/two-agent-review-workflow.md
  docs/CURSOR.md
  docs/CLAUDE_CODE.md
  docs/CODEX_CLI.md
  docs/CROSS_PROVIDER_REVIEW.md
  .claude/agents/code-reviewer.md
  scripts/ai/invoke-cross-reviewer.sh
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$ROOT/$file" ]]; then
    fail "missing required file: $file"
  fi
done

required_cursor_rules=(
  project.mdc
  backend.mdc
  testing.mdc
  docker.mdc
  documentation.mdc
  workflow.mdc
  security.mdc
)

for rule in "${required_cursor_rules[@]}"; do
  path=".cursor/rules/$rule"
  if [[ ! -f "$ROOT/$path" ]]; then
    fail "missing Cursor rule: $path"
  fi
done

# Cursor frontmatter checks
if ! grep -q '^alwaysApply: true' "$ROOT/.cursor/rules/project.mdc"; then
  fail "project.mdc must set alwaysApply: true"
fi

for rule in backend.mdc testing.mdc docker.mdc documentation.mdc workflow.mdc security.mdc; do
  if ! grep -q '^globs:' "$ROOT/.cursor/rules/$rule"; then
    fail "$rule must define globs frontmatter"
  fi
  if grep -q 'alwaysApply: true' "$ROOT/.cursor/rules/$rule"; then
    fail "$rule must not set alwaysApply: true (use globs)"
  fi
done

required_dirs=(agents .commands docs/specs examples)
for dir in "${required_dirs[@]}"; do
  if [[ ! -d "$ROOT/$dir" ]]; then
    fail "missing directory: $dir"
  fi
done

command_files=(
  .commands/spec.md
  .commands/plan.md
  .commands/review-current-branch.md
  .commands/builder-handoff.md
  .commands/two-agent-review.md
  .commands/security-audit.md
)
for file in "${command_files[@]}"; do
  if [[ ! -f "$ROOT/$file" ]]; then
    fail "missing command: $file"
  fi
done

agent_files=(
  agents/backend-reviewer.md
  agents/security-auditor.md
  agents/database-reviewer.md
  agents/devops-ci-reviewer.md
)
for file in "${agent_files[@]}"; do
  if [[ ! -f "$ROOT/$file" ]]; then
    fail "missing persona: $file"
  fi
done

reviewer_headings=(
  "## Blockers"
  "## Should-fix"
  "## Nice-to-have"
  "## Validation concerns"
  "## Security/production risks"
  "## Overengineering/scope creep"
  "## Final verdict"
)
for heading in "${reviewer_headings[@]}"; do
  if ! grep -F "$heading" "$ROOT/.ai-rules/review-checklist.md" >/dev/null; then
    fail "missing reviewer heading: $heading"
  fi
done

approve_gate_files=(
  .ai-rules/git.md
  .ai-rules/agent-orchestration.md
  docs/two-agent-review-workflow.md
)
for file in "${approve_gate_files[@]}"; do
  if ! grep -Fi "approve" "$ROOT/$file" >/dev/null; then
    fail "missing approve gate reference: $file"
  fi
done

if [[ ! -x "$ROOT/scripts/ai/invoke-cross-reviewer.sh" ]]; then
  fail "scripts/ai/invoke-cross-reviewer.sh is not executable"
fi

cross_provider_refs=(
  "AGENTS.md:scripts/ai/invoke-cross-reviewer.sh"
  "CLAUDE.md:scripts/ai/invoke-cross-reviewer.sh"
  ".ai-rules/agent-orchestration.md:.ai-rules/model-routing.md"
  ".ai-rules/agent-orchestration.md:scripts/ai/invoke-cross-reviewer.sh"
  ".ai-rules/model-routing.md:AI_REVIEW_MODEL"
  "scripts/ai/invoke-cross-reviewer.sh:AI_REVIEW_MODEL"
  "scripts/ai/invoke-cross-reviewer.sh:AI_REVIEW_TIER"
)

for entry in "${cross_provider_refs[@]}"; do
  file="${entry%%:*}"
  term="${entry#*:}"
  if ! grep -F "$term" "$ROOT/$file" >/dev/null; then
    fail "$file does not reference $term"
  fi
done

two_agent_doc="$ROOT/docs/two-agent-review-workflow.md"
if ! grep -F "invoke-cross-reviewer.sh claude" "$two_agent_doc" >/dev/null; then
  fail "two-agent-review-workflow.md missing Codex -> Claude path"
fi
if ! grep -F "invoke-cross-reviewer.sh codex" "$two_agent_doc" >/dev/null; then
  fail "two-agent-review-workflow.md missing Claude -> Codex path"
fi

# Source-of-truth pointers in entry files
for entry in AGENTS.md CLAUDE.md; do
  if ! grep -F '.ai-rules/' "$ROOT/$entry" >/dev/null; then
    fail "$entry must reference .ai-rules/"
  fi
done

if ! grep -F '.ai-rules/' "$ROOT/.cursor/rules/project.mdc" >/dev/null; then
  fail "project.mdc must reference .ai-rules/"
fi

# Shell syntax
if ! bash -n "$ROOT/scripts/validate-ai-workflows.sh"; then
  fail "shell syntax error in validate-ai-workflows.sh"
fi
if ! bash -n "$ROOT/scripts/ai/invoke-cross-reviewer.sh"; then
  fail "shell syntax error in invoke-cross-reviewer.sh"
fi

scan_paths=(
  .ai-rules
  .cursor
  .claude
  .commands
  agents
  scripts
  docs
  AGENTS.md
  CLAUDE.md
  README.md
  Makefile
)

# Forbidden coupling in active files (outside reference/)
coupling_patterns=(
  'appointment-voice-saas'
  'Appointment Voice SaaS'
  'AVS-E'
  'appointment-saas-roadmap'
  'fastapi-production-foundation'
  'X-Tenant-Slug'
  'twilio'
)

coupling_exclude_files=(
  scripts/validate-ai-workflows.sh
  docs/GENERICIZATION_REPORT.md
  docs/SOURCE_MANIFEST.md
  docs/ADAPTATION_CHECKLIST.md
  docs/VALIDATION_REPORT.md
  docs/backend-migration
  docs/audits/archive
  README.md
  CONTRIBUTING.md
  CHANGELOG.md
  reference/README.md
)

for pattern in "${coupling_patterns[@]}"; do
  hits=$(grep -R -E -i -l "$pattern" "${scan_paths[@]/#/$ROOT/}" 2>/dev/null || true)
  for hit in $hits; do
    rel="${hit#$ROOT/}"
    skip=0
    for ex in "${coupling_exclude_files[@]}"; do
      if [[ "$rel" == "$ex" || "$rel" == "$ex"/* ]]; then skip=1; break; fi
    done
    if [[ "$skip" -eq 0 ]]; then
      line=$(grep -E -i -n "$pattern" "$hit" | head -1)
      fail "forbidden source-project coupling ($pattern): $rel:$line"
    fi
  done
done

# Absolute home paths (exclude archive snapshots and this validator's own path-literal check)
if grep -R -F '/home/' "${scan_paths[@]/#/$ROOT/}" 2>/dev/null \
  | grep -v 'scripts/validate-ai-workflows.sh' \
  | grep -v 'docs/VALIDATION_REPORT.md' \
  | grep -v 'docs/audits/archive/' \
  | head -1 | grep -q .; then
  hit=$(grep -R -F -n '/home/' "${scan_paths[@]/#/$ROOT/}" 2>/dev/null \
    | grep -v 'scripts/validate-ai-workflows.sh' \
    | grep -v 'docs/VALIDATION_REPORT.md' \
    | grep -v 'docs/audits/archive/' | head -1)
  fail "forbidden absolute path: $hit"
fi

# Obvious secret patterns (redacted reporting)
secret_patterns=(
  'AKIA[0-9A-Z]{16}'
  'sk-[A-Za-z0-9]{20,}'
  'ghp_[A-Za-z0-9]{20,}'
  'BEGIN (RSA |OPENSSH )?PRIVATE KEY'
)
for pattern in "${secret_patterns[@]}"; do
  if grep -R -E -n "$pattern" "${scan_paths[@]/#/$ROOT/}" 2>/dev/null | head -1 | grep -q .; then
    hit=$(grep -R -E -n "$pattern" "${scan_paths[@]/#/$ROOT/}" 2>/dev/null | head -1 | cut -d: -f1-2)
    fail "suspected secret pattern in $hit (value redacted)"
  fi
done

# Broken internal markdown links [[text]](path)
check_md_links() {
  local file="$1"
  while IFS= read -r link; do
  [[ -z "$link" ]] && continue
  local target="${link#*(}"
  target="${target%)*}"
  target="${target%%#*}"
  [[ "$target" =~ ^https?:// ]] && continue
  [[ "$target" =~ ^mailto: ]] && continue
  if [[ ! -e "$ROOT/$target" && ! -e "$(dirname "$file")/$target" ]]; then
    fail "broken markdown link in ${file#$ROOT/}: $target"
  fi
  done < <(grep -oE '\[[^]]+\]\([^)]+\)' "$file" 2>/dev/null | sed -E 's/^\[[^]]+\]\(([^)]+)\)$/\1/' || true)
}

while IFS= read -r md; do
  check_md_links "$md"
done < <(find "$ROOT" \
  \( -path "$ROOT/reference" \
     -o -path "$ROOT/archive" \
     -o -path "$ROOT/docs/audits/archive" \
     -o -path "*/node_modules/*" \) -prune -o \
  -name '*.md' -print)

# Application runtime exclusion (template-only repo — skip for consumer apps)
if [[ ! -f "$ROOT/.ai-rules/consumer-repo" ]]; then
  forbidden_runtime=(
    'app/api/routes'
    'app/services'
    'app/models'
    'alembic/versions'
  )
  for path in "${forbidden_runtime[@]}"; do
    if [[ -e "$ROOT/$path" ]]; then
      fail "application runtime path must not exist: $path"
    fi
  done
fi

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "validate-ai-workflows: all checks passed"
if [[ "$warn" -ne 0 ]]; then
  exit 0
fi
