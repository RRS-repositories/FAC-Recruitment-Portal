# Migrations

Empty until stage 1, which adds the `recruit_*` tables.

**House rule: Claude writes migrations, Brad applies them.** Nothing here ever
runs automatically. Files are `<feature>_<NNN>.sql` with a matching
`_down.sql`, recorded in a `schema_migrations` ledger — the same convention as
`CRM-Finalised/migrations/`.
