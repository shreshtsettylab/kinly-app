// Runs every question in the pool through Kinly's question routing and the "what do I say"
// library, and reports anything that would get the wrong kind of answer.
// Run with: npm run test:questions

import { questionPool } from './questionPool.ts';
import { questionKind } from '../src/questions.ts';
import { findSituation, situations } from '../src/scripts.ts';

let failures = 0;
const byKind = new Map<string, { total: number; ok: number }>();

for (const { q, kind, situation } of questionPool) {
  const gotKind = questionKind(q);
  const gotSituation = gotKind === 'say' ? findSituation(q.toLowerCase())?.id ?? null : undefined;
  const kindOk = gotKind === kind;
  const situationOk = kind !== 'say' || situation === undefined || gotSituation === situation;
  const tally = byKind.get(kind) ?? { total: 0, ok: 0 };
  tally.total++;
  if (kindOk && situationOk) tally.ok++;
  else {
    failures++;
    console.log(`FAIL "${q}"\n     expected ${kind}${kind === 'say' ? ` / ${situation}` : ''}, got ${gotKind}${gotKind === 'say' ? ` / ${gotSituation}` : ''}`);
  }
  byKind.set(kind, tally);
}

// Lines must read naturally with and without a name: no "Hey them," or "sorry, them."
for (const situation of situations) {
  for (const name of ['', 'Maya']) {
    for (const line of situation.lines({ name, minutes: null, when: 'tonight' })) {
      if (/\bthem[,.!]|\b(hey|thank you|congratulations|sorry),? them\b|\$\{|undefined|null/i.test(line) || (name === '' && /, ,|\s,|\s!/.test(line))) {
        failures++;
        console.log(`FAIL ${situation.id} reads badly ${name ? `with "${name}"` : 'with no name'}: ${line}`);
      }
    }
  }
}

// Every situation in the library should have at least one question in the pool.
const covered = new Set(questionPool.map((item) => item.situation).filter(Boolean));
const untested = situations.filter((situation) => !covered.has(situation.id)).map((situation) => situation.id);
if (untested.length) { failures++; console.log(`FAIL situations with no questions in the pool: ${untested.join(', ')}`); }

console.log('\nBy kind:');
for (const [kind, { total, ok }] of byKind) console.log(`  ${kind.padEnd(7)} ${ok}/${total}`);
console.log(`\n${questionPool.length - failures} of ${questionPool.length} questions routed correctly · ${situations.length} situations in the library`);
process.exit(failures ? 1 : 0);
