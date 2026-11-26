import { vrt } from './taxonomy';
import type { Level, SearchMatch, SearchOptions, VrtNode } from './types';

/** Longest query that's searched; the rest is ignored. */
export const MAX_QUERY_LENGTH = 100;

function fold(s: string): string {
  // Lowercase without changing the length, so ranges map onto the original name.
  const lower = s.toLowerCase();
  return lower.length === s.length ? lower : s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function isWordStart(text: string, at: number): boolean {
  return at === 0 || !/[a-z0-9]/.test(text[at - 1]);
}

/**
 * Finds nodes whose names along the path contain every word of `query`, such as
 * "stored xss". Words also match the node IDs, so "idor" finds
 * `broken_access_control.idor`. Results that match at the start of a word, and in
 * the node's own name, rank first; ties keep taxonomy order.
 */
export function search(query: string, options: SearchOptions = {}): SearchMatch[] {
  const taxonomy = options.taxonomy ?? vrt;
  const limit = options.limit ?? 50;
  const words = fold(query.slice(0, MAX_QUERY_LENGTH))
    .split(/[\s›>/._]+/)
    .filter(Boolean)
    .slice(0, 10);
  if (!words.length) return [];

  const scored: Array<{ match: SearchMatch; score: number; order: number }> = [];
  taxonomy.nodes.forEach((node, order) => {
    if (!node.selectable && !options.allowPartial) return;
    const path: VrtNode[] = [];
    for (let n: VrtNode | null = node; n; n = n.parent) path.unshift(n);
    const names = path.map((n) => fold(n.name));
    const ids = path.map((n) => n.id.replace(/_/g, ' '));
    const ranges: SearchMatch['ranges'] = [];
    let score = 0;
    for (const word of words) {
      let best = -1;
      for (let i = path.length - 1; i >= 0; i--) {
        const level = (i + 1) as Level;
        const own = i === path.length - 1 ? 2 : 0;
        let at = names[i].indexOf(word);
        let found = false;
        while (at !== -1) {
          found = true;
          ranges.push({ level, start: at, end: at + word.length });
          best = Math.max(best, own + (isWordStart(names[i], at) ? 3 : 1));
          at = names[i].indexOf(word, at + word.length);
        }
        if (!found) {
          const idAt = ids[i].indexOf(word);
          if (idAt !== -1) best = Math.max(best, own + (isWordStart(ids[i], idAt) ? 2 : 0) + 0.5);
        }
      }
      if (best < 0) return;
      score += best;
    }
    scored.push({ match: { node, ranges: mergeRanges(ranges) }, score: score - path.length * 0.01, order });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.match);
}

function mergeRanges(ranges: SearchMatch['ranges']): SearchMatch['ranges'] {
  const sorted = [...ranges].sort((a, b) => a.level - b.level || a.start - b.start);
  const out: SearchMatch['ranges'] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.level === r.level && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}
