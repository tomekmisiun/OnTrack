> [!WARNING]
> This document is archived and does not describe the current state of the project.
> See the current documentation: [docs/README.md](../../README.md) and [TESTING.md](../../TESTING.md).

# Documentation and test audit — 2026-06-27

Audit of documentation accuracy, test pyramid simplification, and Playwright removal.

---

## Documentation audit table

| File | Cel | Aktualny | Duplikat | Decyzja |
|------|-----|:--------:|:--------:|---------|
| `README.md` | Wejście do projektu | tak (po audycie) | nie | **Przepisany** — TOC, komendy, linki |
| `docs/CURRENT_STATE.md` | Zweryfikowany stan | tak | częściowo z README | **Zaktualizowany** — usunięto Playwright, smoke CI |
| `docs/ARCHITECTURE.md` | Architektura | tak | nie | **Zachować** |
| `docs/DEVELOPMENT.md` | Setup lokalny | tak | nie | **Zaktualizowany** — bez E2E |
| `docs/TESTING.md` | Strategia testów | tak | nie | **Przepisany** — piramida, Playwright verdict |
| `docs/DEPLOYMENT.md` | Deploy Railway | tak | nie | **Zachować** (aktualny) |
| `docs/ROADMAP.md` | Aktywne plany | tak | nie | **Zaktualizowany** — Playwright E2E cancelled |
| `docs/TECH_DEBT.md` | Otwarty dług | tak | nie | **Oczyszczony** — usunięto resolved TD-002/004/008 |
| `docs/SECURITY.md` | Auth/secrets | tak | nie | **Zachować** |
| `docs/ai-workflows.md` | Agent workflow | tak | nie | **Zachować** |
| `docs/backend-migration/*` | Kontrakt API | tak | nie | **Zachować** (binding) |
| `docs/adr/*` | Decyzje arch. | tak | nie | **Zachować** |
| `frontend-next/README.md` | Frontend dev | tak | częściowo z DEVELOPMENT | **Zaktualizowany** |
| `backend/README.md` | Backend dev | tak | nie | **Zachować** |
| `docs/audits/archive/**` | Historia | nie (point-in-time) | — | **Zachować w archive** — nie edytować |
| `.ai-rules/documentation.md` | Zasady dla agentów | tak | nie | **Rozszerzony** — styl README/docs |

### Naprawione niezgodności

- README: „production smoke manual” → staging/production smoke w CI
- CURRENT_STATE: „visual tests exist” → usunięte
- CURRENT_STATE: 7 jobów CI → 5 jobów PR
- TECH_DEBT: TD-002/004 oznaczone resolved zamiast open
- TESTING: Playwright jobs → usunięte z macierzy
- Makefile: `test` wyrównany do CI (dodano `test_catalog_pipeline.py`)

---

## Playwright verdict

**REMOVED** — pełne usunięcie pakietu, testów, konfiguracji, jobów CI, snapshotów.

Zastąpienia opisane w [TESTING.md](../TESTING.md#playwright-decision).
