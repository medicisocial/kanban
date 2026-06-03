/** Placeholder ideas shipped with early builds — not real client work. */
const DEMO_IDEA_TITLES = new Set([
  'GRWM morning routine reel',
  'Behind the scenes at the studio',
  '30-second workout challenge',
  'Product unboxing carousel concept',
]);

/** Keyboard-mash / accidental test titles that should never sync back from cache. */
const JUNK_IDEA_TITLE = /^(asdf|fdsa|qwer|zxcv|dfasd|fdsaf|testtest|xxx+|asdfdsf|asdfsdf)/i;

export function isDemoVideoIdea(idea) {
  if (!idea?.title) return false;
  return DEMO_IDEA_TITLES.has(idea.title.trim());
}

export function isJunkVideoIdea(idea) {
  const title = String(idea?.title || '').trim();
  if (!title) return false;
  return JUNK_IDEA_TITLE.test(title);
}

export function isRejectedVideoIdea(idea) {
  return isDemoVideoIdea(idea) || isJunkVideoIdea(idea);
}

export function stripDemoVideoIdeas(ideas) {
  if (!Array.isArray(ideas)) return [];
  return ideas.filter((idea) => !isRejectedVideoIdea(idea));
}

export function getRejectedVideoIdeaIds(ideas) {
  if (!Array.isArray(ideas)) return [];
  return ideas.filter(isRejectedVideoIdea).map((idea) => String(idea.id)).filter(Boolean);
}
