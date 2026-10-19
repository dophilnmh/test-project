export function normalizeCompetitionCategories(categories) {
  const normalized = [];
  const seen = new Set();

  for (const category of Array.isArray(categories) ? categories : []) {
    const name = String(category || '')
      .trim()
      .slice(0, 80);
    const key = name.toLowerCase();
    if (name.length < 2 || seen.has(key)) continue;
    seen.add(key);
    normalized.push(name);
  }

  return normalized;
}
