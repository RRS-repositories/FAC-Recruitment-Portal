/**
 * AI-use detection — behavioural first, text second.
 *
 * Build spec §13.3 is explicit that text-only detectors false-positive on
 * fluent non-native writers, which is most of this candidate pool. So paste
 * volume and typing speed carry the weight, and phrasing only nudges.
 *
 * This client-side copy exists so the manager dashboard mock can show the
 * feature working. In production the server recomputes it from the same rules
 * and the client's verdict is never stored — thresholds live in
 * `recruit_settings` so they can be tuned without a deploy.
 *
 * A flag is a prompt to look, never a verdict: the reasons are always shown,
 * and nothing is auto-declined on it.
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
};

export function detectAiUse(writtenAnswers, telemetry = {}) {
  const text = Object.values(writtenAnswers ?? {}).join('\n');
  const chars = text.length;
  const reasons = [];
  let score = 0;

  if (telemetry.pasteChars > LIMITS.pasteChars) {
    score += WEIGHTS.paste;
    reasons.push(`Pasted ${telemetry.pasteChars} characters into answer boxes`);
  }

  if (telemetry.typedChars > 0 && telemetry.activeSecs > 0) {
    const cps = telemetry.typedChars / telemetry.activeSecs;
    if (cps > LIMITS.charsPerSecond) {
      score += WEIGHTS.typingSpeed;
      reasons.push(`Typing speed ${cps.toFixed(1)} characters/sec sustained`);
    }
  }

  if (chars > LIMITS.writtenCharsFloor && telemetry.writtenSecs > 0 && telemetry.writtenSecs < LIMITS.writtenSecondsFloor) {
    score += WEIGHTS.fastWritten;
    reasons.push(`${chars} characters written in ${telemetry.writtenSecs}s`);
  }

  const lower = text.toLowerCase();
  const hits = AI_PHRASES.filter((phrase) => lower.includes(phrase));
  if (hits.length >= 2) {
    score += Math.min(WEIGHTS.phrases, hits.length * 10);
    reasons.push(`AI-style phrasing: "${hits.slice(0, 3).join('", "')}"`);
  }

  const emDashes = (text.match(/—/g) ?? []).length;
  if (emDashes >= LIMITS.emDashFloor) {
    score += WEIGHTS.emDashes;
    reasons.push(`${emDashes} em dashes`);
  }

  if (telemetry.tabSwitches >= LIMITS.tabSwitchFloor) {
    score += WEIGHTS.tabSwitches;
    reasons.push(`Left the page ${telemetry.tabSwitches} times while writing`);
  }

  score = Math.min(100, score);
  const level = score >= 60 ? 'ai_used' : score >= 30 ? 'possible' : 'clean';

  return { level, score, reasons };
}

export const AI_LEVEL_LABEL = {
  clean: 'Clean',
  possible: 'Possible AI',
  ai_used: 'AI used',
};
