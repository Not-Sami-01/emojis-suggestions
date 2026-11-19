'use strict';

// Builds data/emojis.json from pinned Unicode Emoji 16.0 and CLDR 46 data.
// Run: npm run build:data (downloads the two source files first).

const fs = require('fs');
const path = require('path');

const EMOJI_TEST = path.join(__dirname, '..', 'data', 'sources', 'emoji-test.txt');
const XMLS = ['cldr-en.xml', 'cldr-en-derived.xml'].map((f) =>
  path.join(__dirname, '..', 'data', 'sources', f)
);
const OUT = path.join(__dirname, '..', 'data', 'emojis.json');

const stripFe0F = (s) => s.replace(/️/g, '');

if (!fs.existsSync(EMOJI_TEST) || XMLS.some((f) => !fs.existsSync(f))) {
  console.error('Unicode source files missing. Run `npm run build:data` to download them.');
  process.exit(1);
}

// ---------- 1. names and emoji order from emoji-test.txt ----------
const emojiTest = fs.readFileSync(EMOJI_TEST, 'utf8');
const byCp = new Map(); // normalized emoji -> { cp, name }
const rowRe = /^([0-9A-F ]+)\s*; fully-qualified\s+#\s+(\S+)\s+E[0-9.]+\s+(.+)$/gm;
let m;
while ((m = rowRe.exec(emojiTest)) !== null) {
  const cp = stripFe0F(m[2]);
  const name = m[3].trim().toLowerCase();
  if (cp && name && !byCp.has(cp)) byCp.set(cp, { cp, name });
}

console.log(`fully-qualified emoji parsed: ${byCp.size}`);

// ---------- 2. keywords from CLDR (base + derived annotations) ----------
const keywords = new Map(); // cp -> string[]

const annRe = /<annotation cp="([^"]+)"(?: type="([^"]+)")?>([^<]*)<\/annotation>/g;
for (const file of XMLS) {
  const xml = fs.readFileSync(file, 'utf8');
  while ((m = annRe.exec(xml)) !== null) {
    const [, rawCp, type, rawBody] = m;
    if (type === 'tts') continue;
    const body = rawBody.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const cp = stripFe0F(rawCp);
    if (!body) continue;
    const kws = body.split('|').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!keywords.has(cp)) keywords.set(cp, []);
    const set = new Set(keywords.get(cp));
    kws.forEach((k) => set.add(k));
    keywords.set(cp, [...set]);
  }
}

console.log(`keyword entries: ${keywords.size}`);

// ---------- 3. merge ----------
const list = [];
let kwHit = 0;
for (const { cp, name } of byCp.values()) {
  const kws = keywords.get(cp) || [];
  if (kws.length) kwHit++;
  list.push({ c: cp, n: name.toLowerCase(), k: kws });
}

// rank defaults: frequently used, recognizable emoji first
const PRIORITY = ['😀', '😂', '🤣', '❤️', '🔥', '👍', '🎉', '😎', '🤔', '💯',
  '😍', '🥰', '😭', '🙏', '👏', '✨', '💀', '😅', '🥺', '😡',
  '💩', '👀', '💪', '🚀', '⭐', '✅', '❌', '⚡', '🌸', '🐱'];
const priIdx = new Map(PRIORITY.map((e, i) => [stripFe0F(e), i]));
list.sort((a, b) => {
  const pa = priIdx.has(a.c) ? priIdx.get(a.c) : Infinity;
  const pb = priIdx.has(b.c) ? priIdx.get(b.c) : Infinity;
  if (pa !== pb) return pa - pb;
  return 0; // otherwise keep Unicode's recommended keyboard order
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(list));
const kb = fs.statSync(OUT).size;
console.log(`wrote ${list.length} emoji (${(kb / 1024).toFixed(0)} KB, ${kwHit} with keywords) -> ${OUT}`);
