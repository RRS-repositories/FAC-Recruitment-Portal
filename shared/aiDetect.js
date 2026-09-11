/**
 * AI-use detection — behavioural first, text second.
 *
 * Build spec §13.3 is explicit that text-only detectors false-positive on
 * fluent non-native writers, which is most of this candidate pool. So paste
 * volume and typing speed carry the weight, and phrasing only nudges.
 *
 * Scoring runs on the server only; the client imports nothing from here but
 * the level labels, so a candidate is never told what was noticed.
 *
 * The numbers are defaults, not constants. `readTuning` folds the `ai_use.*`
 * rows of `recruit_settings` over them, so a threshold that turns out to be
 * wrong for this candidate pool is a settings edit and not a deploy — which is
 * what spec §13.3 asks for. Every value below is what applies when no row
 * overrides it, and the seeded rows currently match them exactly.
 *
 * A flag is a prompt to look, never a verdict: the reasons are always shown,
 * and nothing is auto-declined on it. "AI used" additionally requires the
 * model to agree -- see `levelFor`, which is where the label is decided.
 */

export const AI_PHRASES = [
  "in today's fast-paced",
  'i am writing to express',
  'leverage my',
  'delve',
  'furthermore,',
  'moreover,',
  'in conclusion,',
  'a testament to',
  'i am confident that',
  'it is worth noting',
  'navigate the complexities',
  'spearheaded',
  'meticulous attention to detail',
  'robust understanding',
  'invaluable',
  'underscores',
  'pivotal role',
  'seamlessly',
  'holistic approach',
  'cutting-edge',
];

const WEIGHTS = {
  paste: 45,
  typingSpeed: 30,
  fastWritten: 25,
  phrases: 30,
  emDashes: 10,
  tabSwitches: 15,
};

const LIMITS = {
  pasteChars: 80,
  charsPerSecond: 9,
  writtenSecondsFloor: 60,
  writtenCharsFloor: 300,
  emDashFloor: 3,
  tabSwitchFloor: 4,
  // Not in the seeded settings rows, so these keep their value until somebody
  // adds them. They are here rather than inline so that every number the
  // detector uses is in one place and reachable by the same mechanism.
  phraseHitFloor: 2,
  phrasePointsEach: 10,
};

const THRESHOLDS = {
  possible: 30,
  aiUsed: 60,
};

/** What the detector runs on when nothing has been tuned. */
export const DEFAULT_TUNING = Object.freeze({
  weights: Object.freeze({ ...WEIGHTS }),
  limits: Object.freeze({ ...LIMITS }),
  thresholds: Object.freeze({ ...THRESHOLDS }),
  phrases: Object.freeze([...AI_PHRASES]),
});

/*
 * The stored form is snake_case, because `recruit_settings` is edited by hand
 * and reads better that way; the code form is camelCase. The mapping is
 * written out rather than derived, so a key nobody defined cannot appear in
 * the tuning by accident and a rename has to be deliberate.
 */
const WEIGHT_KEYS = {
  paste: 'paste',
  typing_speed: 'typingSpeed',
  fast_written: 'fastWritten',
  phrases: 'phrases',
  em_dashes: 'emDashes',
  tab_switches: 'tabSwitches',
};

const LIMIT_KEYS = {
  paste_chars: 'pasteChars',
  chars_per_second: 'charsPerSecond',
  written_seconds_floor: 'writtenSecondsFloor',
  written_chars_floor: 'writtenCharsFloor',
  em_dash_floor: 'emDashFloor',
  tab_switch_floor: 'tabSwitchFloor',
  phrase_hit_floor: 'phraseHitFloor',
  phrase_points_each: 'phrasePointsEach',
};

const THRESHOLD_KEYS = {
  possible: 'possible',
  ai_used: 'aiUsed',
};

const inRange = (value, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;

/** Folds one stored object over its defaults, keeping the default per bad field. */
function foldNumbers(defaults, stored, keyMap, max) {
  const out = { ...defaults };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return out;

  for (const [storedKey, codeKey] of Object.entries(keyMap)) {
    if (!(storedKey in stored)) continue;
    if (inRange(stored[storedKey], max)) out[codeKey] = stored[storedKey];
    else console.warn(`[fac-recruit] ignoring unusable ai_use value ${storedKey}=${stored[storedKey]}`);
  }
  return out;
}

const PHRASE_LIMITS = { count: 200, length: 100 };

function foldPhrases(stored) {
  // A non-array is malformed and keeps the built-in list. An empty array is
  // not malformed — it is somebody switching phrase matching off, which is a
  // reasonable thing to want and must be obeyed.
  if (!Array.isArray(stored)) return [...AI_PHRASES];

  return stored
    .filter((p) => typeof p === 'string' && p.trim() !== '')
    .slice(0, PHRASE_LIMITS.count)
    .map((p) => p.trim().toLowerCase().slice(0, PHRASE_LIMITS.length));
}

/**
 * Builds the tuning from `recruit_settings` rows — `[{ key, value }]`.
 *
 * Pure, and total: every route through it returns a usable tuning. A missing
 * row, a malformed value, a key nobody recognises — each falls back to the
 * built-in number for that one field rather than discarding the rest, so a
 * single bad edit cannot switch detection off across the board.
 */
export function readTuning(rows = []) {
  const stored = {};
  for (const row of rows) {
    if (row && typeof row.key === 'string') stored[row.key] = row.value;
  }

  const thresholds = foldNumbers(THRESHOLDS, stored['ai_use.thresholds'], THRESHOLD_KEYS, 100);

  return {
    weights: foldNumbers(WEIGHTS, stored['ai_use.weights'], WEIGHT_KEYS, 100),
    limits: foldNumbers(LIMITS, stored['ai_use.limits'], LIMIT_KEYS, Number.MAX_SAFE_INTEGER),
    // Inverted thresholds would make every application at once "possible" and
    // not "possible", so they are refused as a pair rather than half-applied.
    thresholds: thresholds.aiUsed >= thresholds.possible ? thresholds : { ...THRESHOLDS },
    phrases: foldPhrases(stored['ai_use.phrases']),
  };
}

/**
 * Where the label is decided. The one place, so the two callers cannot drift.
 *
 * THE RULE: the top label needs both judges, and they must have reached it by
 * different routes — the model found something in the text, AND the machine saw
 * it arrive mechanically (pasted, or typed impossibly fast).
 *
 * Behaviour alone can no longer say "AI used", however high it scores, because
 * behaviour cannot see authorship. Pasting is evidence that somebody pasted. It
 * is not evidence of who wrote it — a candidate drafting in Word and a
 * candidate copying from ChatGPT leave the identical trace. Measured against
 * the 290 applications live when this was written, behaviour alone flagged 100
 * and the model disagreed with 82 of them, including one where it said in as
 * many words that the candidate had pasted Latin filler text rather than AI.
 *
 * The model alone cannot say it either. Reading its "likely" rationales, what
 * it mostly detects is *generic* writing — "devoid of personal detail", "high
 * level platitudes" — and generic correlates with inexperience at least as
 * much as with AI. On its own it is a reason to look, never a verdict.
 *
 * So: both agree, by different evidence, and it is "AI used". Either one alone,
 * and it is "worth a look". Neither, and it is clean.
 */
export function levelFor({ score = 0, mechanical = false, opinion = null }, thresholds) {
  const t = thresholds ?? DEFAULT_TUNING.thresholds;
  if (opinion === 'likely' && mechanical) return 'ai_used';
  if (opinion === 'likely' || score >= t.possible) return 'possible';
  return 'clean';
}

/**
 * Which signals count as mechanical corroboration.
 *
 * Tab switches deliberately are not among them. They fire for 181 of 290 live
 * applicants — 62% — and a signal that flags two thirds of everybody cannot
 * discriminate between them. Leaving the page is how people use a browser.
 * They still contribute to the score, and so still raise "worth a look".
 */
const MECHANICAL = ['paste', 'typingSpeed', 'fastWritten'];

export function detectAiUse(writtenAnswers, telemetry = {}, tuning = DEFAULT_TUNING) {
  const { weights, limits, thresholds, phrases } = tuning ?? DEFAULT_TUNING;
  const text = Object.values(writtenAnswers ?? {}).join('\n');
  const chars = text.length;
  const reasons = [];
  const fired = {};
  let score = 0;

  if (telemetry.pasteChars > limits.pasteChars) {
    score += weights.paste;
    fired.paste = true;
    reasons.push(`Pasted ${telemetry.pasteChars} characters into answer boxes`);
  }

  if (telemetry.typedChars > 0 && telemetry.activeSecs > 0) {
    const cps = telemetry.typedChars / telemetry.activeSecs;
    if (cps > limits.charsPerSecond) {
      score += weights.typingSpeed;
      fired.typingSpeed = true;
      reasons.push(`Typing speed ${cps.toFixed(1)} characters/sec sustained`);
    }
  }

  if (chars > limits.writtenCharsFloor && telemetry.writtenSecs > 0 && telemetry.writtenSecs < limits.writtenSecondsFloor) {
    score += weights.fastWritten;
    fired.fastWritten = true;
    reasons.push(`${chars} characters written in ${telemetry.writtenSecs}s`);
  }

  const lower = text.toLowerCase();
  const hits = phrases.filter((phrase) => lower.includes(phrase));
  if (hits.length >= limits.phraseHitFloor) {
    score += Math.min(weights.phrases, hits.length * limits.phrasePointsEach);
    fired.phrases = true;
    reasons.push(`AI-style phrasing: "${hits.slice(0, 3).join('", "')}"`);
  }

  const emDashes = (text.match(/—/g) ?? []).length;
  if (emDashes >= limits.emDashFloor) {
    score += weights.emDashes;
    fired.emDashes = true;
    reasons.push(`${emDashes} em dashes`);
  }

  if (telemetry.tabSwitches >= limits.tabSwitchFloor) {
    score += weights.tabSwitches;
    fired.tabSwitches = true;
    reasons.push(`Left the page ${telemetry.tabSwitches} times while writing`);
  }

  score = Math.min(100, score);

  // No model opinion exists yet at this point — the review runs seconds later,
  // in its own worker. So a freshly submitted application is never labelled
  // "AI used" here, and the review is what promotes it. That is the honest
  // ordering: we have not yet read the words.
  const mechanical = MECHANICAL.some((key) => fired[key] === true);

  return {
    level: levelFor({ score, mechanical, opinion: null }, thresholds),
    score,
    reasons,
    // Carried so the review can apply the rule without re-deriving it from the
    // reason strings, which are wording and would break the moment somebody
    // improved a sentence.
    mechanical,
    signals: fired,
  };
}

export const AI_LEVEL_LABEL = {
  clean: 'Clean',
  possible: 'Possible AI',
  ai_used: 'AI used',
};

/** The three the column can show, in the order a manager reads them. */
export const AI_LEVELS = ['clean', 'possible', 'ai_used'];

/**
 * The label for a level — for ANY level, including ones that should not exist.
 *
 * `AI_LEVEL_LABEL[level]` returns undefined for a value that is not one of the
 * three, and React renders undefined as nothing: a blank cell in the one column
 * whose job is to warn somebody. A null was already handled upstream, but only
 * a null — a level that was misspelt, or added on the server before the client
 * knew about it, fell straight through into an empty badge.
 *
 * So this is total. Every input returns something a person can read, and an
 * unrecognised one says so out loud rather than quietly reading as "Clean",
 * which would be a false reassurance about the very thing being checked.
 */
export function aiLevelLabel(level) {
  return AI_LEVEL_LABEL[level] ?? 'Not checked';
}
