/** Placeholder ideas shipped with early builds — not real client work. */
const DEMO_IDEA_TITLES = new Set([
  'GRWM morning routine reel',
  'Behind the scenes at the studio',
  '30-second workout challenge',
  'Product unboxing carousel concept',
]);

export function isDemoVideoIdea(idea) {
  if (!idea?.title) return false;
  return DEMO_IDEA_TITLES.has(idea.title.trim());
}

export function stripDemoVideoIdeas(ideas) {
  if (!Array.isArray(ideas)) return [];
  return ideas.filter((idea) => !isDemoVideoIdea(idea));
}
