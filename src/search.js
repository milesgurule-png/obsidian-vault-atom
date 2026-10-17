// Note search for the atom view. Pure (no Obsidian or three.js), so it can be unit-tested in Node.

/** Lowercase, strip accents, collapse spaces. */
export function fold(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Score how well a note name matches the query (higher is better, 0 = no match).
 * Exact name > name starts with query > a word starts with query > substring > every query word
 * appears > light fuzzy for single short words (all characters in order, few gaps: "kly" finds "Kelly").
 * @param {boolean} [fuzzy=true] allow the fuzzy tier
 */
export function matchScore(name, query, fuzzy = true) {
  const n = fold(name), q = fold(query);
  if (!q || !n) return 0;
  if (n === q) return 1000;
  if (n.startsWith(q)) return 800 - Math.min(n.length - q.length, 100);
  const at = n.indexOf(q);
  if (at > 0 && /[\s\-_./(]/.test(n[at - 1])) return 600 - Math.min(at, 100);
  if (at > 0) return 400 - Math.min(at, 100);
  const words = q.split(' ');
  if (words.length > 1) return words.every((w) => n.includes(w)) ? 300 - Math.min(n.length, 100) : 0;
  if (!fuzzy) return 0;
  let i = 0, gaps = 0, last = -1;
  for (let j = 0; j < n.length && i < q.length; j++) {
    if (n[j] === q[i]) { if (last >= 0) gaps += j - last - 1; last = j; i++; }
  }
  return i === q.length && gaps <= q.length ? Math.max(1, 200 - gaps * 10 - (n.length - q.length)) : 0;
}

/**
 * Best matches for a query. Ties go to the more-linked note, then alphabetical.
 * @param {{name:string, path:string, deg:number}[]} nodes
 * @returns {{i:number, score:number}[]} indexes into `nodes`
 */
export function searchNotes(nodes, query, limit = 8) {
  if (!fold(query)) return [];
  const hits = [];
  nodes.forEach((n, i) => {
    const s = Math.max(matchScore(n.name, query), matchScore(n.path, query, false) * 0.5);
    if (s > 0) hits.push({ i, score: s });
  });
  hits.sort((a, b) => b.score - a.score || (nodes[b.i].deg || 0) - (nodes[a.i].deg || 0) || nodes[a.i].name.localeCompare(nodes[b.i].name));
  return hits.slice(0, limit);
}
