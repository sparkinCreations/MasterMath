// What the Progress page lists: the saved history narrowed by a search and a
// topic, a page at a time (1.59.0). Pure, so it can be tested without React.

export const HISTORY_PAGE_SIZE = 20;

// Spacing and case never decide a match: "x^2+1" finds "x^2 + 1".
const squash = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, '');

const answerOf = (entry) => {
  const s = entry?.solution;
  return typeof s === 'string' ? s : s?.answer ?? '';
};

// Entries whose problem or answer contains the query, in the given topic
// ('all' or empty for every topic). Order is kept (newest first).
export function filterHistory(problems, { query = '', topic = 'all' } = {}) {
  const list = Array.isArray(problems) ? problems : [];
  const q = squash(query);
  return list.filter((p) => (topic === 'all' || !topic || p.topic === topic)
    && (!q || squash(p.problem).includes(q) || squash(answerOf(p)).includes(q)));
}

// How many entries each topic holds, most first (ties by label), for the
// topic filter: it is the breakdown "Topics covered: 3" never showed.
export function topicCounts(problems, labels = {}) {
  const counts = new Map();
  for (const p of Array.isArray(problems) ? problems : []) counts.set(p.topic, (counts.get(p.topic) || 0) + 1);
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count, label: labels[topic] || topic }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
