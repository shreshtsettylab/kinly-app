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
    id: 'late',
    headline: 'Running late: tell them now',
    intro: 'Message before the time you were due, give an honest arrival time, and don’t over-explain.',
    match: /\b(running|be|am|i'?m|i'?ll be|going to be|gonna be) (\d+ (min|mins|minutes) )?late\b|\blate (again|for)\b|\bbeing late\b/,
    lines: (ctx) => [
      `“So sorry, I’m running late. I’ll be there in ${ctx.minutes ? `about ${ctx.minutes} minutes` : 'about 15 minutes'}. Grab a seat and order something on me?”`,
      `“I’m behind today and I don’t want to keep you waiting. I can be there by [time], or we can push to [time] if that’s easier.”`,
      `When you arrive: “Thank you for waiting. I know your time matters too.”`,
    ],
    tips: ['Send it before you’re due, not after.', 'Give a real arrival time, then add five minutes.'],
  },
  {
    id: 'money',
    headline: 'Talk about money plainly and kindly',
    intro: 'Be specific about the amount and the timing, keep it friendly, and give them an easy way to say yes.',
    match: /\b(pay (me )?back|owes? me|lent|loan(ed)?|borrow (some )?money|money|repay|split(ting)? the (bill|cost|check)|venmo|upi me)\b/,
    lines: () => [
      `“Hey, quick one: could you send back the [amount] from [what it was for] when you get a chance this week? Totally fine to do it in parts.”`,
      `“I’d love to help, but I don’t lend money to friends. It keeps things simple between us. Is there another way I can help?”`,
      `Before the bill comes: “Shall we split it evenly, or each pay for our own?”`,
    ],
    tips: ['Name the amount and a date; vague asks are easy to forget.', 'It’s okay to have a no-lending rule. It protects the friendship.'],
  },
  {
    id: 'accept-apology',
    headline: 'Receive an apology honestly',
    intro: 'Thank them for saying it. You can accept now, or say you need a little time. Both are fine.',
    match: /\b(accept|respond to|reply to|answer) (an |their |his |her |the )?apology\b|\bapologi[sz]es to me\b|\bwhen ([a-z]+ )?apologi[sz]es\b|\bsaid sorry to me\b|\b(says|said|keeps saying) sorry\b/,
    lines: (ctx) => [
      `“Thank you for saying that${ctx.name ? `, ${ctx.name}` : ''}. It means a lot, and I accept.”`,
      `“I appreciate the apology. I still need a little time, but I’m glad you reached out.”`,
      `“Thank you. Next time, could you [what would help]? That would make a real difference to me.”`,
    ],
    tips: ['You don’t have to say “it’s fine” if it wasn’t.', 'Accepting an apology isn’t the same as forgetting it.'],
  },
  {
    id: 'no-reply',
    headline: 'Follow up without pressure',
    intro: 'One light, friendly message is enough. Make it easy to reply, and assume they’re busy, not ignoring you.',
    match: /\b(hasn'?t|haven'?t|didn'?t|doesn'?t|isn'?t|not) (replied|replying|responded|responding|texted back|answered|reply|respond)\b|\bleft (me )?on (read|seen)\b|\bnever (texts?|replies|writes) back\b|\bno (reply|response)\b|\bignoring me\b|\bghosting me\b|\bfollow up\b/,
    lines: (ctx) => [
      `“Hey${ctx.name ? ` ${ctx.name}` : ''}, no pressure to reply — just thinking of you. Hope things are okay.”`,
      `“Bumping this in case it got buried! Still keen to [plan] whenever suits you.”`,
      `“I’ve noticed it’s been quiet, and I hope everything’s alright. I’m here if you want to talk.”`,
    ],
    tips: ['Send one follow-up, then give it time.', 'Ask an easy question they can answer in a few words.'],
  },
  {
    id: 'distance',
    headline: 'Step back from a friendship, kindly',
    intro: 'You don’t need to list every reason. Be honest, brief and kind, and keep it about your needs.',
    match: /\bend (a|the|our|this|my) friendship\b|\bdistance myself\b|\b(don'?t|do not) want to be friends\b|\bstep back from\b|\bcut (them|her|him|someone) off\b|\bdraining (friend|friendship)\b|\bbreak up with (a |my )?friend\b|\bend things with\b|\btoxic (friend|friendship)\b/,
    lines: () => [
      `“I’ve been thinking about our friendship, and I don’t have as much to give right now. I need to step back for a while.”`,
      `“I care about the time we had, but I think we’ve grown in different directions. I wish you well.”`,
      `If you just need less contact: “I’m keeping my evenings quiet these days, so I won’t be around as much.”`,
    ],
    tips: ['Choose words you’d be comfortable hearing yourself.', 'You don’t owe a debate. Kind and clear is enough.'],
  },
  {
    id: 'brief',
    headline: 'Keep it short, and keep it warm',
    intro: 'Say up front that you can’t stay long, so leaving later feels planned, not abrupt.',
    match: /\b(\d+|few|couple( of)?|ten|five|fifteen)\s*(min|mins|minutes)\b|\bhalf an hour\b|\bleave (early|soon|quickly)\b|\bleave (a|the) (party|conversation|event|dinner)\b|\bleave [a-z ]{0,20}early\b|\b(have|need) to leave\b|\bexit (a|the) conversation\b|\b(stop|drop|pop|swing) (by|in)\b|\bquick (visit|hello|hi|catch[- ]?up)\b|\bcan'?t stay( long)?\b|\bonly (stay|have)\b|\bshort visit\b|\bstay (briefly|for a bit)\b/,
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
    match: /\b(cancel\w*|reschedule|postpone|bail|call off|back out|pull out|push (it|back)|rain ?check|move (it|our plan))\b/,
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
    match: /\b(say no|decline|turn (it |them )?down|can'?t (come|make it|go|attend|join)|don'?t want to (go|come)|not (going|coming))\b/,
    lines: (ctx) => [
      `“Thank you for thinking of me! I can’t make it this time, but I hope it’s a lovely evening.”`,
      `“I’d love to, but I’m keeping ${ctx.when === 'right now' ? 'this week' : ctx.when} quiet. Can we catch up another time?”`,
      `“That sounds fun, but I’m going to pass. Let me know about the next one.”`,
    ],
    tips: ['You don’t owe a detailed reason.', 'Only suggest another time if you’d genuinely like one.'],
  },
  {
    id: 'invite',
    headline: 'Ask them to hang out, simply',
    intro: 'Suggest something specific, with a day and a time, so it’s easy to say yes.',
    match: /\b(ask|invite) ([a-z]+ ){0,3}(to )?(hang out|lunch|dinner|coffee|over|out|a drink|drinks)\b|\bhang out\b|\bmake plans\b|\bto be friends\b|\binvite (friends|people|someone|my|a|her|him|them)\b/,
    lines: (ctx) => [
      `“Hey${ctx.name ? ` ${ctx.name}` : ''}! Want to get coffee this Saturday morning? I’d love to catch up.”`,
      `“I’ve really enjoyed our chats. Would you like to grab lunch one day next week?”`,
      `“I’m having a few people over for dinner on [day]. I’d love for you to come.”`,
    ],
    tips: ['A specific plan (“Saturday, 10 am”) gets more yeses than “we should hang out”.', 'If they can’t make it, suggest one other time, then let them pick.'],
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
    id: 'check-in',
    headline: 'Check in gently',
    intro: 'Name what you’ve noticed without judgement, and make it easy for them to say a lot or a little.',
    match: /\bcheck (in )?on\b|\bseems? (down|off|sad|stressed|low|quiet|upset|distant|not okay)\b|\b(are|is) (they|she|he|you) (ok|okay|alright)\b|\bif (they|she|he) (are|is) (ok|okay|alright)\b|\bstruggling\b/,
    lines: (ctx) => [
      `“Hey${ctx.name ? ` ${ctx.name}` : ''}, you’ve seemed a bit low lately, and I wanted to check in. How are you really doing?”`,
      `“No need to explain anything. Just know I’m here for whatever kind of day you’re having.”`,
      `“Want to go for a walk this week? We can talk, or not. Either is fine.”`,
    ],
    tips: ['Ask once, sincerely, then listen more than you advise.', 'If you’re worried about their safety, gently encourage them to reach out to a professional or a helpline.'],
  },
  {
    id: 'support',
    headline: 'Show up for them in a hard time',
    intro: 'You don’t need perfect words. Acknowledge it, say you care, and offer something concrete.',
    match: /\b(lost (their|her|his) (job|mum|mom|dad|father|mother|parent|pet|dog|cat)|loss|passed away|died|funeral|griev\w*|grief|sick|ill(ness)?|hospital|surgery|diagnos\w*|break ?up|broke up|divorce|laid off|going through|sympathy|condolences?)\b/,
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
    match: /\b(ask ([a-z]+ ){0,3}(for )?(a )?(help|favou?r)|ask ([a-z]+ ){1,3}to (watch|help|look after|lend|drive|pick|feed|cover)|need (their |her |his )?help|borrow|lend me|do me a favou?r)\b/,
    lines: () => [
      `“Could I ask a favour? Totally fine to say no — I need a hand with something on Saturday.”`,
      `“I could really use your advice on something. Would you have 20 minutes this week?”`,
      `“No pressure at all, but would you be up for helping me with this?”`,
    ],
    tips: ['Say exactly what and when, so they can decide quickly.', 'Thank them properly, and offer to return the favour.'],
  },
  {
    id: 'miss',
    headline: 'Tell them what they mean to you',
    intro: 'Be specific about why. A real detail lands more warmly than a big statement.',
    match: /\bmiss (her|him|them|you|my)\b|\bi miss\b|\bmeans? (a lot|so much|the world) to me\b|\blove (him|her|them|you)\b|\b(how much|that) i care\b/,
    lines: (ctx) => [
      `“I miss you${ctx.name ? `, ${ctx.name}` : ''}. I was thinking about [a memory] today and it made me smile.”`,
      `“I don’t say it enough, but you mean a lot to me. Thank you for being you.”`,
      `“Life’s been busy, but you’re always on my mind. Can we get some time soon?”`,
    ],
    tips: ['Mention one specific memory or quality.', 'Pair it with a small plan, so it turns into time together.'],
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
    match: /\b(bring (it |this |something )?up|hard conversation|difficult conversation|tell (them|her|him) (that|how|i)|upset (with|about)|confront|been bothering me|hurt my feelings|talk to ([a-z]+ ){1,2}about)\b/,
    lines: () => [
      `“Can I talk to you about something? It’s been on my mind, and you matter to me too much to let it sit.”`,
      `“When that happened, I felt hurt. I’m not trying to blame you — I want us to understand each other.”`,
      `“How did it feel from your side? I’d really like to hear.”`,
    ],
    tips: ['Pick a calm, private moment, not when either of you is rushed.', 'Use “I felt…” rather than “you always…”.'],
  },
];

// Questions asking for words, rather than a yes/no decision.
export const asksForWords = /\bwhat (do|should|can|could|would) i (say|tell|text|write|message|send|reply|respond)\b|\bwhat to (say|tell|text|write|send|reply)\b|\bhow (do|should|can|could) i (say|tell|word|phrase|explain|ask|break it|let (them|her|him) know|apologi[sz]e|decline|turn|cancel|reach out|congratulate|thank|support|bring)\b|\bhow to (say|tell|word|phrase|ask|apologi[sz]e|decline|cancel|reach out|congratulate|thank)\b|\bhelp me (say|write|word)\b|\bwhat (are|is) (a |some )?(good|nice|kind) (way|ways|words?|things?) to\b/;

export const normaliseQuestion = (question: string) => question.toLowerCase().replace(/[’‘]/g, "'").trim();

export function findSituation(question: string): Situation | null {
  const q = normaliseQuestion(question);
  return situations.find((situation) => situation.match.test(q)) ?? null;
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
