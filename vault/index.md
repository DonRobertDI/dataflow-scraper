# Vault Index

## wiki/

| File                         | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `CODEBASE.md`                | Monorepo structure, file map, ports, quick reference |
| `APP_EVENT_SUMMARY.md`       | High-level summary of app events and state           |
| `GLOBAL_PROMPT.md`           | Global system prompt / instructions                  |
| `LOCAL_PROMPT.md`            | Local / session-specific prompt overrides            |
| `FIRST_GENERATION_PROMPT.md` | Extra guidance injected on the first gen of an app   |

## wiki/skills/

Each skill is a folder with a `SKILL.md` entry (the hub) and a `references/` subfolder for deep-dives. Load `<skill>/SKILL.md` first; pull individual `<skill>/references/*.md` files only when the entry tells you to.

| Skill         | SKILL.md (entry)      | Description                                                                                              |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| `express/`    | `express/SKILL.md`    | Express.js route conventions, secrets handling, upstream API workflow                                    |
| `pocketbase/` | `pocketbase/SKILL.md` | PocketBase hub: architecture, the two hard rules, minimum migration, sub-skill index                     |
| `hostinger-ecommerce/` | `hostinger-ecommerce/SKILL.md` | Hostinger store API helpers, cart, inventory, categories, and checkout patterns |
| `design/`     | `design/SKILL.md`     | Frontend craft, styling, typography, motion, shadcn policy, and anti-slop heuristics for UI surfaces   |

## wiki/skills/express/references/

| File                          | Description                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `CONNECTING_TO_POCKETBASE.md` | OPT-IN: when Express genuinely needs to talk to PB (3rd-party + PB writes). Lazy client factory. |

## wiki/skills/pocketbase/references/

Foundations:
| File | Description |
|------|-------------|
| `MIGRATIONS.md` | Base layer: filename rules, up/down, how reload_app applies them |
| `USING_IN_REACT.md` | Default path: React → PB direct (auth, CRUD, realtime, files) |
| `HOOKS.md` | Server-side reactions: transactional email (`$app.newMailClient`), default/redact fields per request, brand auth emails |
| `RECORD_OPERATIONS.md` | JSVM record getters, fetch helpers, and relation expansion (`$app.expandRecord`) |
| `FIELD_TYPES.md` | All field types (relation, select, file, json, date, geoPoint, etc.) |
| `ACCESS_RULES.md` | listRule/viewRule/createRule/updateRule/deleteRule expressions (designing from scratch) |
| `INDEXES.md` | Unique, composite, partial, case-insensitive indexes (designing from scratch) |
| `RAW_SQL.md` | Escape hatch for bulk updates / cross-collection aggregates |

Collection operations:
| File | Description |
|------|-------------|
| `CREATE_COLLECTION.md` | New base (non-auth) collection, fields, rules, indexes (idempotent) |
| `CREATE_AUTH_COLLECTION.md` | Users / staff / OTP auth collections and seeded admins |
| `DELETE_COLLECTION.md` | Drop a collection, with relation-cascade ordering |
| `RENAME_COLLECTION.md` | Rename a collection (preserves data, frontend follow-up needed) |

Field operations (existing collection):
| File | Description |
|------|-------------|
| `ADD_FIELD.md` | Add a new field with idempotency + per-type templates |
| `REMOVE_FIELD.md` | Drop a field with index cascade and rollback restoration |
| `RENAME_FIELD.md` | Rename a field, with the rule/index follow-up checklist |
| `UPDATE_FIELD.md` | Change required/min/max/values/maxSize/cascadeDelete/etc. |

Rules + indexes on existing collection:
| File | Description |
|------|-------------|
| `UPDATE_RULES.md` | Mutate listRule/viewRule/createRule/updateRule/deleteRule/manageRule/authRule |
| `UPDATE_INDEXES.md` | Add or remove indexes via `collection.indexes.push` / `.filter` |

Records / seeding / data:
| File | Description |
|------|-------------|
| `SEED_DATA.md` | Seed inside create migrations or in a follow-up; `_lookup` pattern for relations |
| `UPDATE_RECORDS.md` | findRecordsByFilter + loop + r.set + app.save (validated bulk update) |
| `DELETE_RECORDS.md` | findRecordsByFilter + loop + app.delete (with cascade caveats) |

Auth features:
| File | Description |
|------|-------------|
| `OAUTH_PROVIDERS.md` | Configure Google/GitHub/Apple/Discord/… with $os.getenv secrets and upsert |
| `OTP_AUTH.md` | Email-code (passwordless) auth, OTP-only or hybrid |
| `MFA.md` | Two-factor on top of password, opt-in (`mfaEnabled` field) or mandatory |

## wiki/skills/design/references/

| File           | Description                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `ANIMATION.md` | The 12 animation principles mapped to web UI; read for motion-heavy work (reveals, transitions, micro-interactions, interaction-led heroes) |
