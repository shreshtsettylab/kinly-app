// Checks how Kinly reads what someone wrote after time together: the feeling, energy afterwards,
// themes, things to ask about next time, and things they said they'd do.
// Run with: npm run test:feelings

import { readText } from '../src/feelings.ts';

type Case = { text: string; tone?: string; energy?: 'up' | 'down' | null; themes?: string[]; followUps?: number; promises?: number; followUpHas?: string; promiseHas?: string };

const cases: Case[] = [
  { text: 'Had a great time, we laughed so much.', tone: 'positive', followUps: 0 },
  { text: 'It was fine. Mostly small talk.', tone: 'negative' },
  { text: 'Not bad at all, actually.', tone: 'positive' },
  { text: "It wasn't that fun, she was on her phone the whole time.", tone: 'negative' },
  { text: 'Lovely dinner but I was tired after.', tone: 'mixed', energy: 'down' },
  { text: 'So lovely and fun, even though I was a bit tired.', tone: 'positive' },
  { text: 'Felt heard for the first time in ages. Left feeling better.', tone: 'positive', energy: 'up' },
  { text: "Didn't feel heard. He talked over me again.", tone: 'negative' },
  { text: 'We went for a walk and talked about her new job.', tone: 'neutral', themes: ['Work', 'Milestones'] },
  { text: "She's moving to Pune next month and I'll help her pack.", followUps: 1, promises: 1, followUpHas: 'Pune', promiseHas: 'help her pack', themes: ['Home and moving'] },
  { text: 'He has an interview on Friday. Ask him how it went.', followUps: 2, themes: ['Work'] },
  { text: 'I promised to send her the photos from Goa.', promises: 1, followUps: 0 },
  { text: 'Her mum has surgery soon, she seemed worried.', followUps: 1, themes: ['Health', 'Family'] },
  { text: 'They are planning to get engaged in December!', followUps: 1, themes: ['Love life'] },
  { text: 'Next time, pick somewhere quieter.', followUps: 1 },
  { text: 'I need to call him back about the trip.', promises: 1, themes: ['Travel'] },
  { text: 'It was awkward and a bit forced. Felt drained after.', tone: 'negative', energy: 'down' },
  { text: 'Felt energised, really needed that.', tone: 'positive', energy: 'up' },
  { text: 'We argued about money again.', tone: 'negative', themes: ['Money'] },
  { text: 'Watched a movie, ate pizza.', tone: 'neutral', followUps: 0, promises: 0, themes: ['Hobbies'] },
  { text: 'Not tired at all, it was relaxing.', tone: 'positive', energy: null },
  { text: 'It didn’t feel awkward this time, which was nice.', tone: 'positive' },
  { text: "Honestly I couldn't wait to leave.", tone: 'negative' },
  { text: 'She’s been struggling at work and might quit.', themes: ['Work', 'Stress'] },
  { text: 'Exam results come out next week, remember to check in.', followUps: 1, themes: ['Milestones'] },
  { text: 'I should text her more often.', promises: 1 },
  { text: '', tone: 'neutral', followUps: 0, promises: 0 },
];

let failures = 0;
for (const item of cases) {
  const got = readText(item.text);
  const problems: string[] = [];
  if (item.tone && got.tone !== item.tone) problems.push(`tone ${got.tone} (wanted ${item.tone})`);
  if (item.energy !== undefined && got.energy !== item.energy) problems.push(`energy ${got.energy} (wanted ${item.energy})`);
  if (item.themes && item.themes.some((theme) => !got.themes.includes(theme))) problems.push(`themes ${JSON.stringify(got.themes)} (wanted ${JSON.stringify(item.themes)})`);
  if (item.followUps !== undefined && got.followUps.length !== item.followUps) problems.push(`followUps ${JSON.stringify(got.followUps)} (wanted ${item.followUps})`);
  if (item.promises !== undefined && got.promises.length !== item.promises) problems.push(`promises ${JSON.stringify(got.promises)} (wanted ${item.promises})`);
  if (item.followUpHas && !got.followUps.some((line) => line.includes(item.followUpHas as string))) problems.push(`no follow-up with "${item.followUpHas}"`);
  if (item.promiseHas && !got.promises.some((line) => line.includes(item.promiseHas as string))) problems.push(`no promise with "${item.promiseHas}"`);
  if (problems.length) { failures++; console.log(`FAIL "${item.text}"\n     ${problems.join('\n     ')}`); }
}
console.log(`\n${cases.length - failures} of ${cases.length} notes read as expected`);
if (failures) process.exit(1);
