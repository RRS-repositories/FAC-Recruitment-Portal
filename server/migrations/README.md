# Migrations

Applied with `node server/scripts/apply-migrations.js`, which records each file
in a `schema_migrations` ledger and skips anything already applied — the same
shape as the `scripts/apply-*-migrations.mjs` runners in `CRM-Finalised`.

**House rule: Claude writes migrations, Brad applies them.** Nothing in this
directory is ever executed automatically, and never against the CRM cluster.

| File | Effect |
|---|---|
| `atlas_enquiries_001.sql` | Creates `atlas_enquiries` + 3 indexes. Additive only. |
| `atlas_enquiries_001_down.sql` | Drops them. **Destroys captured enquiries.** |
