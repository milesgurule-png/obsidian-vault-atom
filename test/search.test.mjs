import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, matchScore, searchNotes } from '../src/search.js';

const nodes = [
  { name: 'Kelly Criterion', path: 'Quant Lab/Kelly Criterion.md', deg: 25 },
  { name: 'Fractional Kelly', path: 'Quant Lab/Fractional Kelly.md', deg: 4 },
  { name: 'Scott Kelly Twin Study', path: 'Frontier Lab/Scott Kelly Twin Study.md', deg: 9 },
  { name: 'Loss Aversion', path: 'Mind Lab/Loss Aversion.md', deg: 53 },
  { name: 'Interstellar Medium Survival', path: 'Frontier Lab/Interstellar Medium Survival.md', deg: 6 },
  { name: 'Café Notes', path: 'Daily/Café Notes.md', deg: 1 },
];
const names = (q) => searchNotes(nodes, q).map((r) => nodes[r.i].name);

test('fold ignores case, accents and extra spaces', () => {
  assert.equal(fold('  Café   NOTES '), 'cafe notes');
});

test('ranking: exact > prefix > word start > substring', () => {
  assert.ok(matchScore('Kelly', 'kelly') > matchScore('Kelly Criterion', 'kelly'));
  assert.ok(matchScore('Kelly Criterion', 'kelly') > matchScore('Fractional Kelly', 'kelly'));
  assert.ok(matchScore('Fractional Kelly', 'kelly') > matchScore('Smokelly', 'kelly'));
  assert.equal(names('kelly')[0], 'Kelly Criterion');
});

test('multi-word queries need every word; no loose fuzzy matches', () => {
  assert.deepEqual(names('loss av'), ['Loss Aversion']);
  assert.deepEqual(names('twin kelly'), ['Scott Kelly Twin Study']);
});

test('light fuzzy for short single words, but not scattered letters', () => {
  assert.ok(names('kly').includes('Kelly Criterion'));
  assert.equal(matchScore('Interstellar Medium Survival', 'lossav'), 0);
});

test('accents, folders and empty queries', () => {
  assert.deepEqual(names('cafe'), ['Café Notes']);
  assert.ok(names('mind lab').includes('Loss Aversion'), 'folder path matches by substring');
  assert.deepEqual(names('   '), []);
  assert.deepEqual(names('zzzz'), []);
});

test('ties go to the more-linked note and results are capped', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `Note ${String(i).padStart(2, "0")}`, path: `N/Note ${i}.md`, deg: i }));
  const r = searchNotes(many, 'note', 8);
  assert.equal(r.length, 8);
  assert.equal(many[r[0].i].deg, 19);
});
