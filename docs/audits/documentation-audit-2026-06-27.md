# Documentation audit — 2026-06-27

**Branch:** `chore/docs-audit-and-reset` (merged #163)  
**Baseline commit:** `01ff765` (`main`)  
**Status:** **Complete** — living docs reset merged 2026-06-27  
**Method:** code-first inventory (backend routes, Alembic head, CI, Railway, tests) + full `.md` grep for links and references.

---

## Executive summary

The repository had **89 Markdown files**, many outdated or duplicated. Living docs were split across `docs/`, `docs/deployment/`, `docs/backend-migration/`, and a **950-line README** that duplicated operational detail.

**Decision:** Replace scattered status/deploy/roadmap docs with a **minimal `docs/` set** (`CURRENT_STATE`, `ARCHITECTURE`, `DEVELOPMENT`, `DEPLOYMENT`, `ROADMAP`, `TECH_DEBT`, `SECURITY`) while **keeping** binding references (`API_CONTRACT.md`, `.ai-rules/`, agent entry indexes, ADRs, archives).


## Proposed target map

```
README.md                          ← slim entry point
docs/
├── CURRENT_STATE.md               ← NEW — factual today
├── ARCHITECTURE.md                ← NEW
├── DEVELOPMENT.md                 ← NEW
├── TESTING.md                     ← updated
├── DEPLOYMENT.md                  ← NEW (merges deploy runbooks)
├── ROADMAP.md                     ← NEW (replaces PROJECT_REMEDIATION_ROADMAP)
├── TECH_DEBT.md                   ← NEW
├── SECURITY.md                    ← NEW
├── adr/                           ← 0001, 0002, +0003 locale/market
├── backend-migration/             ← API contract + compat (living subset)
├── ai-workflows.md                ← kept (agent workflow)
├── two-agent-review-workflow.md   ← kept
├── CURSOR.md, CLAUDE_CODE.md, CODEX_CLI.md, CROSS_PROVIDER_REVIEW.md  ← kept (CI validation)
├── specs/README.md                ← kept (placeholder)
└── audits/
    ├── documentation-audit-2026-06-27.md   ← this file
    └── archive/                   ← includes June 2026 state audit
.github/DEPLOY.md                  ← short pointer → docs/DEPLOYMENT.md
```

---

## File decision table

| File | Obecna rola | Problem | Decyzja | Uzasadnienie |
|------|-------------|---------|---------|--------------|
| `README.md` | Hub (~950 lines) | Duplikuje docs; stale Redis/scraper claims | **update** (slim) | Wejście do repo; linki do `docs/` |
| `docs/CURRENT_STATE.md` | — | Brak | **create** | Kanoniczny „stan dziś” |
| `docs/ARCHITECTURE.md` | — | Brak | **create** | Komponenty z kodu |
| `docs/DEVELOPMENT.md` | — | Brak | **create** | Local dev, env, commands |
| `docs/DEPLOYMENT.md` | — | Brak | **create** | Merge deploy runbooks |
| `docs/ROADMAP.md` | — | Brak | **create** | Zastępuje remediation roadmap |
| `docs/TECH_DEBT.md` | — | Brak | **create** | Konkretny dług z dowodami |
| `docs/SECURITY.md` | — | Brak | **create** | Auth, secrets, BFF |
| `docs/TESTING.md` | CI matrix | Stare liczby testów | **update** | Komendy, nie liczby |
| `docs/PRODUCTION_READINESS.md` | Readiness matrix | Snapshot 2026-06-26; overlap | **delete** | Treść → CURRENT_STATE + SECURITY |
| `docs/PROJECT_REMEDIATION_ROADMAP.md` | 17-task backlog | Wiele tasków done/outdated | **delete** | → ROADMAP + TECH_DEBT |
| `docs/CRA_REFERENCE.md` | CRA archive guide | Wąski | **delete** | → DEVELOPMENT.md § Archive |
| `docs/FRONTEND_NEXT_BFF.md` | BFF threat model | Overlap ADR 0001 | **archive** | → `audits/archive/` + condensed `SECURITY.md` |
| `docs/deployment/RAILWAY_*.md` (×2) | Railway runbooks | Duplikat DEPLOY | **delete** | → DEPLOYMENT.md |
| `docs/backend-migration/RAILWAY_STAGING.md` | Staging notes | Overlap | **delete** | → DEPLOYMENT.md § Staging |
| `docs/audits/ui-locale-market-separation-audit.md` | PL audit pre-impl | Done (#150) | **archive** | → `audits/archive/` |
| `docs/architecture/adr-ui-locale-market-separation.md` | ADR locale/market | Orphan path | **move** | → `docs/adr/0003-ui-locale-market-separation.md` |
| `docs/audits/archive/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md` | June audit | Point-in-time | **archive** | Moved out of living tree |
| `docs/audits/archive/**` (16 files) | Historical | Already archived | **keep** | Decision records |
| `docs/backend-migration/API_CONTRACT.md` | API matrix | Living; binding refs | **keep** | `.cursor/rules`, `context-map` |
| `docs/backend-migration/AUTH_COMPATIBILITY.md` | Auth parity | Flask-as-current header | **update** | Post-cutover framing |
| `docs/backend-migration/DATABASE_COMPATIBILITY.md` | DB analysis | Flask-era framing | **update** | Post-cutover framing |
| `docs/backend-migration/DB_REHEARSAL.md` | Stamp rehearsal | Valid ops | **keep** | Linked from DEPLOYMENT |
| `docs/backend-migration/README.md` | Migration index | Stale links | **update** | Living vs archived |
| `docs/adr/0001-*.md`, `0002-*.md` | ADRs | Current | **keep** | Referenced in README/DEPLOY |
| `docs/ai-workflows.md` + tool docs | Agent workflow | Required by CI | **keep** | `validate-ai-workflows.sh` |
| `.ai-rules/**`, `AGENTS.md`, `CLAUDE.md` | Binding | — | **keep** | Do not delete |
| `agents/**`, `.commands/**` | Optional prompts | — | **keep** | |
| `archive/**/README.md` (×3) | Archive warnings | Broken CRA link | **update** | Fix path |
| `backend/README.md`, `frontend-next/README.md` | Component entry | Overlap DEVELOPMENT | **update** (short) | Point to `docs/DEVELOPMENT.md` |
| `app/dish_compare/README.md`, `app/user_seeds/README.md` | Legacy pointers | — | **keep** | Minimal |

---

## Conflicts: old docs vs code (verified 2026-06-27)

| Claim (old docs) | Actual state (code) |
|------------------|---------------------|
| Alembic head in June 2026 audit doc | **`c2d3e4f5a6b7`** (current head) |
| Scraper at repo root | **`archive/scraper-legacy/`** only |
| Production UI | **`frontend-next/`** only |

---

## Documents slated for deletion (6)

1. `docs/PRODUCTION_READINESS.md`
2. `docs/PROJECT_REMEDIATION_ROADMAP.md`
3. `docs/CRA_REFERENCE.md`
4. `docs/deployment/RAILWAY_BACKEND_MIGRATION.md`
5. `docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md`
6. `docs/backend-migration/RAILWAY_STAGING.md`

**Archived (not deleted):** `docs/FRONTEND_NEXT_BFF.md` → `docs/audits/archive/FRONTEND_NEXT_BFF.md`

Content merged into new docs before deletion. Empty `docs/deployment/` directory removed.

---

## Documents requiring update (12+)

See table above — README, TESTING, backend-migration compat headers, component READMEs, `.github/DEPLOY.md`, `context-map.md`, archive CRA link.

---

## Unverified / environment-specific

- Exact Railway public URLs (not in repo)
- Production DB row counts / backup schedule (operator responsibility)

---

## Validation plan

- `rg` for deleted filenames across repo
- `make validate` (AI workflow static check)
- Manual review of README links
- No application code changes in this branch
