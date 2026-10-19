# Sentinel AI Security Architecture

Security is built into Sentinel AI at the architectural level, not as a post-hoc addition.

---

## 1. Authentication & Session Management
- **Password Hashing**: Implemented using `bcrypt` with automatic salt generation. Plaintext passwords are never logged, serialized, or stored.
- **JWT Tokens**: Signed with `HS256` using the server-side `SECRET_KEY`. Expiration defaults to 7 days and can be tuned via `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Protected Routes**: Protected frontend routes check active JWT tokens and verify session validity with the `/api/v1/auth/me` endpoint.

---

## 2. Ingestion API Key Security
- **High-Entropy Generation**: Keys are created with `secrets.token_urlsafe(32)` prefixed with `sentinel_`.
- **Zero Raw Key Persistence**: Raw key strings are returned **only once** upon creation.
- **SHA-256 Storage**: The database only stores a cryptographic SHA-256 hash:
  $$\text{key\_hash} = \text{SHA-256}(\text{raw\_key})$$
- **Instant Revocation**: Setting `is_active = False` immediately invalidates the key across all ingestion endpoints without server restarts.

---

## 3. Multi-Tenant Workspace & Project Isolation
- All entity access checks enforce workspace ownership boundaries:
  ```python
  stmt = (
      select(Project)
      .join(Workspace, Project.workspace_id == Workspace.id)
      .where(Project.id == project_id, Workspace.owner_id == current_user.id)
  )
  ```
- Automated regression test `tests/backend/test_security_isolation.py` validates that User B cannot query, modify, or inspect User A's projects, traces, API keys, or datasets.

---

## 4. Defense-in-Depth & Injection Protection
- **SQL Injection**: Prevented via parameterized SQLAlchemy 2.x async ORM queries.
- **Input Validation**: Pydantic v2 schemas enforce typed boundaries on all payloads.
- **No Secret Leaks**: Health and status endpoints explicitly exclude secret configuration values.

## Demo environment boundary

`POST /api/v1/auth/demo-login` is only enabled for `ENVIRONMENT=development`. Newly created demo users have randomly generated, undisclosed passwords. Before deployment, remove legacy demo accounts and rotate the JWT signing secret so previously issued development sessions cannot be used in production. See `console-redesign.md` for remaining hardening requirements.
