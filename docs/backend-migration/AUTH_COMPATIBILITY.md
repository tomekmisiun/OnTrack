# Authentication compatibility

High-risk area. All decisions below must be implemented explicitly in MIG-004 — no silent semantic changes.

---

## Current Flask / OnTrack auth (confirmed)

| Aspect | Implementation | Source |
|--------|----------------|--------|
| JWT library | `flask-jwt-extended` | `app/__init__.py`, `app/routes/auth.py` |
| Signing key | `JWT_SECRET_KEY` env | `config.py` |
| Algorithm | HS256 (flask-jwt-extended default) | **Inferred** — not overridden in config |
| Identity claim | `str(user.id)` via `create_access_token(identity=...)` | `auth.py` |
| Token lifetime | 7 days (`JWT_ACCESS_TOKEN_EXPIRES`) | `config.py` |
| Response shape | `{ "token": "<jwt>" }` | `auth.py` `_issue_jwt` |
| Authorization header | `Bearer <token>` | `frontend/src/api.js` |
| Token storage | `localStorage.token` | `AuthContext.js` |
| 401 JSON | `{ "error": "Authentication required" }` / `"Invalid token"` / `"Session expired — please log in again"` | `app/__init__.py` JWT loaders |
| 401 behavior | Frontend clears token + full page reload | `api.js` |
| Password hash | Werkzeug `generate_password_hash` / `check_password_hash` | `app/models/user.py` |
| Password scheme | Werkzeug default (scrypt/pbkdf2 depending on Werkzeug version) | **Inferred** from werkzeug API |
| Refresh tokens | **None** | — |
| Token revocation | **None** (no blocklist) | — |
| Registration | Username + password; synthetic email `{username}@users.ontrack.local` | `auth.py` |
| Google OAuth | authlib; callback issues one-time `AuthCode` → frontend exchanges for JWT | `auth.py`, `AuthCode` model |
| OAuth exchange | `POST /api/auth/exchange` `{ code }` → `{ token }` | `auth.py` |
| User language | `user.lang`; `PATCH /api/auth/language` | `auth.py` |

---

## FastAPI foundation auth (v1.0.0 reference)

| Aspect | Implementation | Source |
|--------|----------------|--------|
| JWT library | `python-jose` | `app/core/security.py` |
| Signing key | `SECRET_KEY` (single key) | `app/core/config.py` |
| Algorithm | HS256 | `config.py` |
| Access token claims | `sub`, `tenant_id`, `token_version`, `exp`, `type`, `jti` | `security.py` |
| Refresh tokens | Yes (`type: refresh`) | `security.py`, `auth.py` routes |
| Password hash | **bcrypt** via passlib | `security.py` |
| Login response | `{ access_token, refresh_token, token_type }` | `app/schemas/auth.py` `Token` |
| Registration | Email-based `UserCreate`; returns `UserRead` | `app/api/routes/auth.py` |
| Tenant | Required `tenant_id` on every token | Multi-tenant foundation |
| Token revocation | `token_version` on user row | Migration `d4e5f6a7b8c9` |
| Rate limiting | Redis-backed on auth endpoints | `app/api/dependencies/rate_limit.py` |
| Password reset | Full flow with worker email jobs | Template feature |

---

## Compatibility decisions (required for migration plan)

### 1. Existing password hashes

| Decision | **Keep valid — verify with werkzeug `check_password_hash` in FastAPI** |
|----------|------------------------------------------------------------------------|
| Rationale | Production users have werkzeug hashes; template bcrypt is incompatible |
| Implementation | Use `werkzeug.security` in `backend/app/core/passwords.py` OR passlib configured for werkzeug schemes |
| Optional upgrade | Rehash to bcrypt on successful login (**DEFER** — not required for cutover) |
| Risk if ignored | **BLOCKER** — all password logins fail after cutover |

### 2. Active JWT tokens after cutover

| Decision | **Remain valid if signing key and claims compatible** |
|----------|------------------------------------------------------|
| Conditions | Same `JWT_SECRET_KEY`; `sub` = user id string; HS256; acceptable `exp` |
| Must avoid | Template claims requiring `tenant_id`, `token_version`, `type` on validation |
| Implementation | Issue Flask-compatible tokens from `OnTrackTokenService`; validate with minimal claim set |
| Risk if ignored | **HIGH** — all logged-in users forced to re-login (acceptable fallback but avoid if easy) |

### 3. Must users log in again?

| Scenario | Expected |
|----------|----------|
| Cutover with compatible JWT + same `JWT_SECRET_KEY` | **No** — sessions continue |
| Cutover with new secret or incompatible claims | **Yes** — plan communication |
| OAuth | New `AuthCode` flow unchanged — exchange still works |

### 4. Preserve `{ "token": "..." }` contract

| Decision | **External API always returns `{ token }` for login, register, exchange** |
|----------|-------------------------------------------------------------------------|
| Internal | May use foundation token helpers privately but **adapt** at router boundary |
| Prohibited | Exposing `access_token` / `refresh_token` to frontend without adapter |

### 5. Template refresh tokens

| Decision | **DEFER / internal only** |
|----------|---------------------------|
| Rationale | Frontend has no refresh flow; adding refresh changes 401 semantics |
| Future | Optional refresh behind feature flag without frontend change |

---

## Google OAuth flow (must preserve)

```
Login.js → GET /api/auth/google?lang=
         → Google consent
         → GET /api/auth/google/callback (backend)
         → 302 FRONTEND_URL/?code=<auth_code>
AuthContext → POST /api/auth/exchange { code }
            → { token }
            → GET /api/auth/me
```

| Requirement | Detail |
|-------------|--------|
| Redirect URI | `GOOGLE_REDIRECT_URI` env (e.g. `http://localhost:5001/api/auth/google/callback`) |
| Cookie | `pending_lang` httponly; `SameSite=None` + `Secure` when not debug |
| Code TTL | `AUTH_CODE_TTL_SECONDS` (default 120) |
| Error path | `?auth_error=` query param |

**FastAPI port:** Use Starlette OAuth or httpx + authlib; replicate redirect and cookie behavior exactly.

---

## CORS

| Item | Flask |
|------|-------|
| Origins | `FRONTEND_URL` (comma-separated allowed) | `app/__init__.py` |
| Credentials | Not explicitly required for Bearer JWT | |

FastAPI must allow frontend origin for browser OAuth redirects and API calls.

---

## 401 / error shape compatibility

Frontend depends on **status code 401**, not exact error JSON, for logout (`api.js`).

Contract tests should still assert Flask error bodies for developer parity.

---

## Environment variable mapping (auth-related)

| Flask (current) | FastAPI backend (proposed) |
|-----------------|----------------------------|
| `JWT_SECRET_KEY` | `JWT_SECRET_KEY` (keep name for Railway parity) |
| `FLASK_SECRET_KEY` | `APP_SECRET_KEY` or keep for cookie signing only |
| `GOOGLE_CLIENT_ID` | same |
| `GOOGLE_CLIENT_SECRET` | same |
| `GOOGLE_REDIRECT_URI` | same |
| `FRONTEND_URL` | same |
| `AUTH_CODE_TTL_SECONDS` | same |

---

## Test requirements (MIG-004)

- [ ] Login/register/exchange return `{ token }` only.
- [ ] `/api/auth/me` shape matches contract.
- [ ] Werkzeug hash from Flask-created user verifies in FastAPI.
- [ ] JWT from Flask validates in FastAPI (cross-compat fixture).
- [ ] JWT from FastAPI validates on Flask (**during parallel period only**).
- [ ] OAuth callback redirect (mocked) produces redeemable code.
- [ ] 401 on expired/invalid token.
- [ ] `DELETE /api/auth/me` cascade.

---

## Unresolved questions

| ID | Question |
|----|----------|
| AQ1 | Exact werkzeug hash method in production DB (`scrypt` vs `pbkdf2`) — sample on staging clone |
| AQ2 | Are any users email-only (Google) without username? Login path is username-only for password |
| AQ3 | Railway cookie `Secure` + `SameSite=None` on OAuth — verify in staging HTTPS |
