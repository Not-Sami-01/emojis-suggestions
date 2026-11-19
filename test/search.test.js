'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { suggest } = require('../src/suggestions');

const chars = (list) => list.map((e) => e.c);

test('empty query shows recents first, then defaults', () => {
  const out = suggest('', ['💋']);
  assert.equal(out[0].c, '💋');
  assert.ok(out.length > 1);
  // defaults fill in behind the recents
  assert.ok(chars(out).includes('😀'));
});

test('empty query without recents starts with curated defaults', () => {
  const out = suggest('');
  assert.equal(out[0].c, '😀');
});

test('search finds by name', () => {
  const out = suggest('cat');
  assert.equal(out[0].c, '🐈');
  assert.ok(out.every((e) => e.n.includes('cat') || e.c.includes('🐈')));
});

test('search finds by keyword', () => {
  const out = suggest('fire');
  assert.equal(out[0].c, '🔥');
});

test('skin-tone variants rank after the plain emoji', () => {
  const out = suggest('thumbs');
  const plain = out.findIndex((e) => e.c === '👍');
  const toned = out.findIndex((e) => e.c === '👍🏻');
  assert.notEqual(plain, -1);
  assert.notEqual(toned, -1);
  assert.ok(plain < toned, 'plain 👍 must rank before 👍🏻');
});

test('no match returns nothing', () => {
  assert.deepEqual(suggest('zzzzzz'), []);
});

test('query is case-insensitive and trimmed', () => {
  assert.deepEqual(chars(suggest('  FIRE  ')), chars(suggest('fire')));
});
