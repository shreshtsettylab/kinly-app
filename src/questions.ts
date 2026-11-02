import { asksForWords, findSituation, normaliseQuestion } from './scripts';

// What kind of answer a question needs. The Home question box routes every question through
// this; tests/questions.test.mts runs the whole question pool (tests/questionPool.ts) against it.
//   say    — ready-made words for a situation ("what do I say if…")
//   cancel — keep or reschedule an existing plan
//   talk   — things to bring up with someone
//   who    — which person could use some attention
//   recall — what they saved about someone or something
//   when   — last and next time with someone
//   decide — should I…? (the default)
export type QuestionKind = 'say' | 'cancel' | 'talk' | 'who' | 'recall' | 'when' | 'decide';

const cancel = /\b(cancel\w*|skip|bail|reschedule|re-schedule|call (it )?off|postpone|back out|pull out|flake|rain ?check|move (our|the) (plan|dinner|lunch|coffee|meeting))\b/;
const talk = /\b(talk about|bring up|conversation (starters?|topics?|ideas?)|discuss|say to|topics?|what (can|could|should) i ask|questions? (to|i could|i can) ask|chat about|ask (them|her|him|[a-z]+) about)\b/;
const who = /\bwho\b|\bwhich (friend|person|people)\b|\banyone i (haven'?t|have not)\b|\bsomeone (to|i could) (call|text|see|message)\b/;
const decide = /\b(should|shall|worth|ought)\b|\bis it (ok|okay|fine|alright|rude|bad|weird|too (soon|late|much))\b|\b(ok|okay|fine|rude) (to|if)\b|\bdo i (go|need to|have to)\b|\bwould it be\b|\bam i (seeing|spending|being)\b|\bcan i (skip|say no|go)\b/;
const recall = /\b(learn|learned|learnt|remember|recall|notes?|reflect\w*|happened|how did|how was|what do i know|what did i (write|note|save|say)|remind me|tell me about|summar(y|ise|ize)|catch me up)\b/;
const when = /\b(when|how long|last time i (saw|met|spoke|talked)|how often)\b/;

export function questionKind(question: string): QuestionKind {
  const q = normaliseQuestion(question);
  if (asksForWords.test(q)) return 'say';
  // "How do I leave a party early?" asks for words too, when it matches a known situation.
  if (/\bhow (do|can|should|could|would) i\b|\bhow to\b/.test(q) && findSituation(q)) return 'say';
  if (cancel.test(q)) return 'cancel';
  if (talk.test(q)) return 'talk';
  if (who.test(q)) return 'who';
  if (decide.test(q)) return 'decide';
  if (recall.test(q)) return 'recall';
  if (when.test(q)) return 'when';
  return 'decide';
}
