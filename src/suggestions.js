'use strict';

const db = require('../data/emojis.json');

// Curated list shown when nothing has been typed yet.
const DEFAULT_CHARS = [
  '😀', '😂', '🤣', '🥰', '😍', '😎', '🤔', '😅',
  '😭', '😡', '👍', '👏', '🙏', '💪', '🔥', '❤️',
  '🎉', '✨', '💯', '🚀', '🍕', '☕', '🐱', '🐶',
];

const byChar = new Map(db.map((e) => [e.c, e]));

// Skin-tone variants rank after the plain emoji they derive from.
const SKIN_TONE = /[\u{1F3FB}-\u{1F3FF}]/u;

// Lower score = better match.
function score(e, w) {
  const n = e.n;
  let s = -1;
  if (n === w) s = 0;
  else if (n.startsWith(w)) s = 1;
  else if (e.k.includes(w)) s = 2;
  else if (e.k.some((k) => k.startsWith(w))) s = 3;
  else if (n.includes(w)) s = 4;
  else if (e.k.some((k) => k.includes(w))) s = 5;
  if (s >= 0 && SKIN_TONE.test(e.c)) s += 1;
  return s;
}

function suggest(rawWord, recents = [], limit = 12) {
  const w = (rawWord || '').toLowerCase().trim();
  if (!w) {
    // Recently picked emoji first, then the curated defaults.
    const out = [];
    const seen = new Set();
    for (const c of recents) {
      if (out.length >= limit) break;
      const e = byChar.get(c);
      if (e && !seen.has(c)) {
        out.push({ c: e.c, n: e.n });
        seen.add(c);
      }
    }
    for (const c of DEFAULT_CHARS) {
      if (out.length >= limit) break;
      if (!seen.has(c)) {
        out.push({ c, n: byChar.has(c) ? byChar.get(c).n : '' });
        seen.add(c);
      }
    }
    return out;
  }

  const hits = [];
  for (let i = 0; i < db.length; i++) {
    const s = score(db[i], w);
    if (s >= 0) hits.push({ e: db[i], s, i });
  }
  hits.sort((a, b) => a.s - b.s || a.i - b.i);
  return hits.slice(0, limit).map((h) => ({ c: h.e.c, n: h.e.n }));
}

module.exports = { suggest };
