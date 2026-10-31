// "What do I say?" — a library of everyday social situations, each with a few warm, ready-to-use
// lines and a gentle tip. It runs entirely in the browser: free, instant and private. Lines are
// personalised with the person's name and any time mentioned; the app adds the person's notes.

export type Situation = {
  id: string;
  headline: string;
  intro: string;
  // Matched against the lower-cased question.
  match: RegExp;
  lines: (ctx: ScriptContext) => string[];
  tips: string[];
};

export type ScriptContext = { name: string; minutes: number | null; when: string };

const them = (ctx: ScriptContext) => ctx.name || 'them';
const timeLine = (ctx: ScriptContext) => (ctx.minutes ? `about ${ctx.minutes} minutes` : 'a little while');

// Order matters: more specific situations come first.
export const situations: Situation[] = [
  {
    id: 'brief',
    headline: 'Keep it short, and keep it warm',
    intro: 'Say up front that you can’t stay long, so leaving later feels planned, not abrupt.',
    match: /\b(\d+|few|couple( of)?|ten|five|fifteen)\s*(min|mins|minutes)\b|\bleave (early|soon|quickly)\b|\b(stop|drop|pop|swing) (by|in)\b|\bquick (visit|hello|hi|catch[- ]?up)\b|\bcan'?t stay( long)?\b|\bonly (stay|have)\b|\bshort visit\b|\bstay (briefly|for a bit)\b/,
    lines: (ctx) => [
      `“I can only stay for ${timeLine(ctx)}, but I really wanted to see you.”`,
      `“I’ve got something after this, so I’ll head off in ${timeLine(ctx)} — tell me everything before I go.”`,
      `When it’s time: “This was so good. I have to run, but let’s plan something longer soon.”`,
    ],
    tips: ['Mention the time limit in your first minute, not as you stand up.', 'Spend the time on them: ask one real question and listen.'],
  },
  {
    id: 'cancel',
    headline: 'Cancel kindly, and offer another time',
    intro: 'Tell them early, keep the reason short and honest, and suggest a new time in the same message.',
    match: /\b(cancel|reschedule|postpone|bail|call off|push (it|back)|rain ?check|move (it|our plan))\b/,
    lines: (ctx) => [
      `“I’m so sorry, I need to cancel ${ctx.when}. I’ve been running on empty and wouldn’t be good company. Could we do next week instead?”`,
      `“Something’s come up and I can’t make it ${ctx.when}. I hate doing this — are you free on the weekend?”`,
      `“I need a quiet night, so I’m going to cancel. I was looking forward to it, and I’d love to rebook.”`,
    ],
    tips: ['The earlier you tell them, the kinder it lands.', 'A specific new time shows you still want to see them.'],
  },
  {
    id: 'decline',
    headline: 'Say no without over-explaining',
    intro: 'A short, warm no is kinder than a long excuse. Thank them, decline, and leave the door open if you mean it.',
    match: /\b(say no|decline|turn (it |them )?down|can'?t (come|make it|go|attend|join)|don'?t want to (go|come)|not (going|coming)|invitation|invite)\b/,
    lines: (ctx) => [
      `“Thank you for thinking of me! I can’t make it this time, but I hope it’s a lovely evening.”`,
      `“I’d love to, but I’m keeping ${ctx.when === 'right now' ? 'this week' : ctx.when} quiet. Can we catch up another time?”`,
      `“That sounds fun, but I’m going to pass. Let me know about the next one.”`,
    ],
    tips: ['You don’t owe a detailed reason.', 'Only suggest another time if you’d genuinely like one.'],
  },
  {
    id: 'apologise',
    headline: 'A sincere apology, without excuses',
    intro: 'Name what happened, own your part, and say what you’ll do differently. Skip the “but”.',
    match: /\b(sorry|apologi[sz]e|apology|messed up|my fault|hurt (them|her|him|their)|let (them|her|him) down|forgot (their|her|his))\b/,
    lines: (ctx) => [
      `“${ctx.name ? `${ctx.name}, I’m` : 'I’m'} sorry about what happened. I can see it hurt you, and that wasn’t fair to you.”`,
      `“You were right to be upset. I should have handled it differently, and I will next time.”`,
      `“I’ve been thinking about it, and I owe you an apology. Can we talk when you’re ready?”`,
    ],
    tips: ['Apologise for what you did, not for how they feel.', 'Give them time; don’t ask for forgiveness straight away.'],
  },
  {
    id: 'reconnect',
    headline: 'Reach out after a long gap',
    intro: 'Don’t over-apologise for the silence. A warm, specific message makes it easy to reply.',
    match: /\b(haven'?t (talked|spoken|seen|heard|messaged|texted)|been (a while|ages|so long)|long time|reconnect|out of touch|lost touch|drifted|ghosted|reach out)\b/,
    lines: (ctx) => [
      `“Hey ${them(ctx)}, I was just thinking about you. It’s been too long — how have you been?”`,
      `“Something reminded me of you today and I realised how long it’s been. Fancy a catch-up soon?”`,
      `“I know I’ve been quiet. No pressure to reply quickly — I’d just love to hear how you are.”`,
    ],
    tips: ['Mention something specific you remember about them.', 'Suggest something small, like a call or coffee, not a big plan.'],
  },
  {
    id: 'boundary',
    headline: 'Set a boundary, kindly and clearly',
    intro: 'Say what you need in plain words, without blame. Clear is kind.',
    match: /\b(boundar\w*|need (some )?space|too much|stop (asking|calling|texting|messaging)|overwhelm\w*|say (that )?i need|keeps? (asking|calling|texting))\b/,
    lines: () => [
      `“I care about you, and I need a bit more space right now. It’s not about you — I’m stretched thin.”`,
      `“I can’t always reply straight away, and that’s okay. I’ll get back to you when I can.”`,
      `“I’m not comfortable talking about that. Can we change the subject?”`,
    ],
    tips: ['Keep it short; long explanations invite debate.', 'Repeat it calmly if needed. You don’t need a new reason each time.'],
  },
  {
    id: 'support',
    headline: 'Show up for them in a hard time',
    intro: 'You don’t need perfect words. Acknowledge it, say you care, and offer something concrete.',
    match: /\b(lost (their|her|his) (job|mum|mom|dad|father|mother|parent|pet|dog|cat)|loss|passed away|died|funeral|griev\w*|grief|sick|ill(ness)?|hospital|surgery|diagnos\w*|break ?up|broke up|divorce|laid off|struggling|going through)\b/,
    lines: (ctx) => [
      `“I just heard, and I’m so sorry, ${them(ctx)}. I’m here for you.”`,
      `“No need to reply. I’m thinking of you, and I’d like to drop off dinner this week if that would help.”`,
      `“I don’t know exactly what to say, but I care about you. Would a call or a walk help?”`,
    ],
    tips: ['Offer something specific instead of “let me know if you need anything”.', 'Check in again in a week or two, when others have gone quiet.'],
  },
  {
    id: 'celebrate',
    headline: 'Celebrate their good news',
    intro: 'Be specific about what you’re happy about, and ask them to tell you more.',
    match: /\b(congrat\w*|promot\w*|new job|engaged|engagement|wedding|married|baby|pregnan\w*|birthday|graduat\w*|anniversary|got (in|the job)|good news)\b/,
    lines: (ctx) => [
      `“Congratulations, ${them(ctx)}! You worked so hard for this. How are you feeling?”`,
      `“This is such wonderful news. I’d love to celebrate with you — drinks on me soon?”`,
      `“I’m so happy for you. Tell me everything!”`,
    ],
    tips: ['Name what they did, not just the outcome.', 'A small follow-up later in the week means a lot.'],
  },
  {
    id: 'ask',
    headline: 'Ask for help without feeling awkward',
    intro: 'Be specific about what you need, make it easy to say no, and say thank you either way.',
    match: /\b(ask ([a-z]+ )?(for )?(a )?(help|favou?r)|need (their |her |his )?help|borrow|lend me|do me a favou?r)\b/,
    lines: () => [
      `“Could I ask a favour? Totally fine to say no — I need a hand with something on Saturday.”`,
      `“I could really use your advice on something. Would you have 20 minutes this week?”`,
      `“No pressure at all, but would you be up for helping me with this?”`,
    ],
    tips: ['Say exactly what and when, so they can decide quickly.', 'Thank them properly, and offer to return the favour.'],
  },
  {
    id: 'thanks',
    headline: 'Say thank you so it lands',
    intro: 'Name what they did and the difference it made to you.',
    match: /\b(thank\w*|grateful|appreciat\w*)\b/,
    lines: (ctx) => [
      `“Thank you, ${them(ctx)}. What you did really helped, and I won’t forget it.”`,
      `“I wanted to say how much I appreciated you being there. It meant a lot.”`,
      `“You made my week easier. Thank you for that.”`,
    ],
    tips: ['Specific thanks feels much warmer than a general one.', 'A message a day or two later still counts.'],
  },
  {
    id: 'hard-talk',
    headline: 'Open a difficult conversation gently',
    intro: 'Start with why the relationship matters, describe what happened without blame, then listen.',
    match: /\b(bring (it |this |something )?up|hard conversation|difficult conversation|tell (them|her|him) (that|how|i)|upset (with|about)|confront|been bothering me|talk to (them|her|him) about)\b/,
    lines: () => [
      `“Can I talk to you about something? It’s been on my mind, and you matter to me too much to let it sit.”`,
      `“When that happened, I felt hurt. I’m not trying to blame you — I want us to understand each other.”`,
      `“How did it feel from your side? I’d really like to hear.”`,
    ],
    tips: ['Pick a calm, private moment, not when either of you is rushed.', 'Use “I felt…” rather than “you always…”.'],
  },
];

// Questions asking for words, rather than a yes/no decision.
export const asksForWords = /\bwhat (do|should|can|could|would) i (say|tell|text|write|message)\b|\bwhat to (say|tell|text|write)\b|\bhow (do|should|can|could) i (say|tell|word|phrase|explain|ask|break it|let (them|her|him) know|apologi[sz]e|decline|turn|cancel|reach out|congratulate|thank|support|bring)\b|\bhow to (say|tell|word|phrase|ask|apologi[sz]e|decline|cancel|reach out|congratulate|thank)\b|\bhelp me (say|write|word)\b|\bwhat (are|is) (a |some )?(good|nice|kind) (way|ways|words?|things?) to\b/;

export function findSituation(question: string): Situation | null {
  return situations.find((situation) => situation.match.test(question)) ?? null;
}

export function minutesIn(question: string): number | null {
  const words: Record<string, number> = { five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };
  const match = question.match(/\b(\d{1,3}|five|ten|fifteen|twenty|thirty)\s*(min|mins|minutes)\b/);
  if (!match) return null;
  const value = words[match[1]] ?? Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// A general shape for any "what do I say" question the library doesn't recognise.
export const generalLines = (name: string) => [
  `Start warm: “${name ? `${name}, ` : ''}I’ve been thinking about you, and I wanted to be honest with you.”`,
  'Say the one thing that matters most, in a sentence.',
  'Offer what you can do, or a next step: “Could we…?”',
];
