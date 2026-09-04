-- recruit_003_seed
-- Baseline rows the portal cannot run without: the interviewer, his
-- availability, and the AI-detection defaults from spec §13.
--
-- Idempotent — ON CONFLICT DO NOTHING throughout — so re-running is safe and
-- so this never overwrites a value someone has since tuned in the UI.

-- ── The interviewer ─────────────────────────────────────────────────────────
-- Placeholder email until the FAC Workspace address is confirmed (§10.2). It
-- must be a Workspace account, not a personal Gmail, before stage 6 can
-- impersonate it for calendar access.
INSERT INTO recruit_interviewers (full_name, email, google_calendar_id, personal_timezone)
VALUES ('Priyanshu Srivastava', 'priyanshu@fastactionclaims.co.uk', 'primary', 'Asia/Kolkata')
ON CONFLICT (email) DO NOTHING;

-- ── His availability ────────────────────────────────────────────────────────
-- Anchored to Europe/London, not his own IST day. 09:00-17:00 UK is
-- IST 13:30-21:30 and SAST 10:00-18:00 in summer — civil for both candidate
-- regions, and matching the "UK-aligned hours" already stated in the India
-- job ad. Anchoring to IST would have offered SA candidates 05:30 slots.
INSERT INTO recruit_availability_rules (
  interviewer_id, timezone, weekdays, day_start, day_end,
  slot_minutes, buffer_minutes, min_notice_hours, max_days_ahead, blocks
)
SELECT
  i.id, 'Europe/London', '{1,2,3,4,5}', '09:00', '17:00',
  30, 0, 24, 14,
  '[{"start":"11:30","end":"12:30","label":"Lunch"}]'::jsonb
FROM recruit_interviewers i
WHERE i.email = 'priyanshu@fastactionclaims.co.uk'
ON CONFLICT (interviewer_id) DO NOTHING;

-- ── AI-use detection defaults ───────────────────────────────────────────────
-- Thresholds live in the database so Brad can tighten or loosen them without
-- a deploy (§13.3). Weights favour behaviour over text: §13.3 is explicit that
-- text-only detection false-positives on fluent non-native writers, which is
-- most of this candidate pool.
INSERT INTO recruit_settings (key, value) VALUES
  ('ai_use.thresholds', '{"ai_used": 60, "possible": 30}'::jsonb),
  ('ai_use.weights', '{
     "paste": 45,
     "typing_speed": 30,
     "fast_written": 25,
     "phrases": 30,
     "em_dashes": 10,
     "tab_switches": 15
   }'::jsonb),
  ('ai_use.limits', '{
     "paste_chars": 80,
     "chars_per_second": 9,
     "written_seconds_floor": 60,
     "written_chars_floor": 300,
     "em_dash_floor": 3,
     "tab_switch_floor": 4
   }'::jsonb),
  ('ai_use.phrases', '[
     "in today''s fast-paced", "i am writing to express", "leverage my", "delve",
     "furthermore,", "moreover,", "in conclusion,", "a testament to",
     "i am confident that", "it is worth noting", "navigate the complexities",
     "spearheaded", "meticulous attention to detail", "robust understanding",
     "invaluable", "underscores", "pivotal role", "seamlessly",
     "holistic approach", "cutting-edge"
   ]'::jsonb),
  -- The dashboard highlights anything finished faster than this.
  ('application.fast_submit_seconds', '240'::jsonb)
ON CONFLICT (key) DO NOTHING;
