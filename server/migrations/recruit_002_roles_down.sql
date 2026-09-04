-- recruit_002_roles_down
-- Revokes what recruit_002_roles granted. The role itself is not dropped —
-- it is created outside the migrations, and dropping a login role out from
-- under a running service is a bigger action than reversing a grant.

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"app_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"app_role";
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"app_role";
REVOKE USAGE ON SCHEMA public FROM :"app_role";
