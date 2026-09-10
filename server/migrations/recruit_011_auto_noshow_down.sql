-- Undo recruit_011. Interviews already marked stay marked: the sweep recorded
-- something that happened, and removing the switch does not unhappen it.
DROP INDEX IF EXISTS idx_recruit_interviews_unmarked;
DELETE FROM recruit_settings WHERE key = 'flags.recruitment_auto_noshow';
