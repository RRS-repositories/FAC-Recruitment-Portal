-- recruit_007_admins (down)
--
-- Removes the accounts table and the role type.
--
-- READ THIS BEFORE RUNNING IT. Rolling back does not restore the previous
-- arrangement by itself: the application falls back to ADMIN_USERS, and if
-- that variable has since been emptied — which it should be, once real
-- accounts exist — nobody can sign in at all.
--
-- So put the people back into ADMIN_USERS first. The hashes are already in the
-- right format and can be copied straight across:
--
--   \copy (SELECT username || ':' || email || ':' || password_hash
--            FROM recruit_admins WHERE active)
--        TO 'admin-users.txt'
--
-- Join those lines with commas into ADMIN_USERS, restart, and only then run
-- this. Roles are lost either way — the environment list has never had them,
-- so everyone who can sign in will be able to do everything again.

BEGIN;

DROP TABLE IF EXISTS recruit_admins;
DROP TYPE IF EXISTS admin_role;

COMMIT;
