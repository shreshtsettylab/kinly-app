// The blog's posts. Plain data with no browser code, because vite.config.ts also imports it at
// build time to write a static HTML page per post (so links unfurl with the right title and
// description in WhatsApp and LinkedIn, which don't run JavaScript).
//
// Every product, pricing and privacy statement here was checked against the app. When a limit or
// feature changes, update the posts too.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ol' | 'ul'; items: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  label: string;
  date: string; // YYYY-MM-DD
  summary: string;
  body: Block[];
};

const p = (text: string): Block => ({ type: 'p', text });
const h2 = (text: string): Block => ({ type: 'h2', text });
const ol = (...items: string[]): Block => ({ type: 'ol', items });

// Newest first; posts that share a date keep this order.
export const blogPosts: BlogPost[] = [
  {
    slug: 'why-i-built-kinly',
    title: 'Why I built Kinly',
    description: 'Why I built Kinly, a personal relationship copilot: business school fills your life with new people and leaves no system for keeping them.',
    label: 'Founder story',
    date: '2026-11-14',
    summary: 'Business school fills your life with new people and leaves no system for keeping them.',
    body: [
      p('Business school fills your life with new people and leaves you zero time to keep up with them. Every week someone new matters to me, and every week I lose track of someone who already did. Not because I stopped caring. Because there is no system for friendships the way there is for classes, deadlines and placements.'),
      p('Calendars remember meetings. To-do apps remember tasks. Nothing remembers that you haven’t spoken to a close friend in three weeks, or that last time you met, they mentioned a big move and you promised to ask about it.'),
      p('So I built Kinly. It’s a personal relationship copilot. You add your people, ask it real questions, and it answers from what you’ve saved, with the reasons shown. “Should I meet Arjun tonight?” is a real question, and the answer depends on your energy, when you last met, and what’s already planned. Kinly thinks about exactly that.'),
      p('It also helps with the hard part: what to say. Cancelling kindly, reconnecting after months, asking for money back, saying “I miss you”. Small words that decide whether a friendship survives a busy year.'),
      p('A few things I cared about while building it:'),
      ol(
        'It’s private. Your notes stay in your browser, and backup is optional. No sign-up needed.',
        'It never decides for you. It shows the trade-offs and the reasons. You make the call.',
        'It isn’t a dating app, a therapy app, or another chatbot. It’s a quiet layer over the people you already have.',
      ),
      p('Kinly is free and live at kinly.in, and it launched on Product Hunt on November 13, 2026. If you’ve ever realised a friendship faded and you can’t say when, I built this for you. Try it and tell me what’s missing.'),
    ],
  },
  {
    slug: 'friendships-drift',
    title: 'Friendships don’t end. They drift.',
    description: 'Most friendships fade through silence, not fights. Kinly’s small loop (add your people, ask real questions, reflect) is built to catch the drift early.',
    label: 'The problem',
    date: '2026-11-14',
    summary: 'Most friendships fade through silence, not fights. A small loop to catch the drift early.',
    body: [
      p('Most friendships don’t finish with a fight. They fade through silence. One postponed plan, then a busy month, then the awkward feeling that too much time has passed to just say hello. The drift is slow enough that you never notice it happening, and final enough that one day the person is a contact you scroll past.'),
      p('The tools we have don’t help. A calendar tells you where to be, not who you’re losing touch with. Social media shows you what acquaintances had for lunch while your closest friends go quiet. Messaging apps keep every conversation, but none of them tap you and say: it’s been 12 days, and last time she mentioned the studio move.'),
      p('That’s the gap Kinly fills. The loop is small on purpose:'),
      ol(
        'Add your people. A name, a note, a plan. That’s enough to start.',
        'Ask a real question. Should I go? What do I say? You get a clear answer with the reasons shown, shaped by your energy and your history with that person.',
        'Reflect afterwards. A tap or a few lines on how it felt. Over time, patterns appear: who leaves you energised, how busy weeks change your energy, who you’re drifting from.',
      ),
      p('On top of that, Kinly keeps you honest about priorities. A few goals for the month, not thirty. A weekly connection goal, so staying in touch is a plan instead of a vague intention. And ready-made words for the moments that are easy to avoid: cancelling kindly, apologising well, following up without pressure.'),
      p('It won’t make you a better friend by itself. It makes it harder to forget to be one.'),
    ],
  },
  {
    slug: 'kinly-in-five-minutes',
    title: 'Kinly in five minutes: ask, decide, reflect',
    description: 'A tour of Kinly as it works today: people, plans, goals, decisions with reasons shown, reflections, pricing and how your data is handled.',
    label: 'The product',
    date: '2026-11-14',
    summary: 'A tour of Kinly as it works today, from people and plans to pricing and your data.',
    body: [
      p('Kinly is a personal relationship copilot that runs free in your browser, with no sign-up. Here’s what’s inside, exactly as it works today.'),
      h2('People'),
      p('A page for each person who matters, with your notes and your shared history. Not a contact list: a memory you can actually use. “Ask about the studio move” stays on Maya’s page, and Kinly brings it up before you next meet.'),
      h2('Plans'),
      p('Your week at a glance, with plans linked to people. You can import them from Google Calendar, so Kinly knows you’re already seeing Arjun on Saturday before it answers anything about tonight.'),
      h2('Goals'),
      p('A few priorities for the month, and a weekly connection goal: how many people you want to see each week. A small number on purpose. The point is a few priorities kept honest, not a dashboard you abandon by February.'),
      h2('Decisions'),
      p('This is the heart. You ask a real question from the Home screen, and Kinly answers with a clear verdict, the reasons behind it, and the trade-offs. Your energy check-in shapes the answer: “Not tonight” is sometimes the right call, and Kinly will say so. If you then need the words, ask “What do I say to cancel?” and you get a few kind ways to put it.'),
      h2('Reflections'),
      p('After you meet someone, tap how it went or write a few lines. Kinly notices patterns across your check-ins and reflections, so “how am I spending time with the people who matter?” becomes a question with a real answer.'),
      h2('What it costs'),
      p('The free plan covers up to 5 people, 15 questions a month, 10 new plans a month, up to 3 active goals, and unlimited reflections and notes. Kinly Plus is ₹99 a month or ₹999 a year. It removes those limits and adds 20 AI credits a month for AI reflections, deeper decision analysis and weekly relationship reviews. Payments are handled by Razorpay.'),
      h2('What happens to your data'),
      p('Your notes stay in your browser. Backup to a private account is optional, and you can export, restore or delete everything from Settings, any time. Nothing is sent anywhere unless you use one of the AI features, and then only the notes that question needs.'),
      p('Try it at kinly.in. It takes less time than the coffee you’re putting off with someone.'),
    ],
  },
  {
    slug: 'three-goals',
    title: 'Why three goals are enough',
    description: 'Kinly Free holds three active goals and one weekly connection goal. Why a short, honest list beats a long one.',
    label: 'Design choice',
    date: '2026-11-14',
    summary: 'Three active goals and one weekly connection goal. Why a short list beats a long one.',
    body: [
      p('Most productivity apps let you add unlimited goals, and most people learn what that’s worth by February. A list of twelve priorities is a list of zero. When everything matters, nothing gets chosen, and the app becomes a museum of good intentions.'),
      p('Kinly Free holds three active goals at a time. Plus lifts that limit, but three is still where we’d start. Three is small enough to remember without opening the app, and small enough that choosing one means not choosing another. That trade-off is the point: a priority you can’t say no for isn’t a priority.'),
      p('The same thinking shapes the weekly connection goal. One goal about the people who matter, revisited every week. Not a streak to protect, not a score to game. Just a recurring question: did you actually spend time this week on the relationships you say are important?'),
      p('Relationships usually lose to everything else because everything else has a deadline. Assignments, work, chores: all of them shout. Friendships whisper, right up until they’re gone. A small, honest set of goals is how the whisper gets a place on the same list as the shouting.'),
      p('Three priorities. One weekly connection goal. Kept honest, not kept perfectly.'),
    ],
  },
  {
    slug: 'what-to-say',
    title: 'What to say when it’s been too long',
    description: 'The longest silence in a friendship is followed by the hardest message. Why Kinly treats the words as part of the product, not an afterthought.',
    label: 'The hard moments',
    date: '2026-11-14',
    summary: 'The longest silence is followed by the hardest message. Why the words matter.',
    body: [
      p('The longest silence in a friendship is usually followed by the hardest message. Not because there’s nothing to say, but because every draft sounds like an apology for the silence itself. So people send nothing, and the silence gets longer, and the message gets harder.'),
      p('It’s rarely one big moment. It’s a dozen small ones, each easy to postpone: cancelling a plan without sounding cold, saying no without guilt, checking in without an agenda, asking for money back, apologising well, reconnecting after months, saying “I miss you” out of nowhere. The words are short. Finding them isn’t.'),
      p('That’s why Kinly treats words as part of the product, not an afterthought. Ask “What do I say?” and you get a few kind ways to put it, with the person’s name already in. When Kinly suggests someone you haven’t seen in weeks, the idea comes with a message ready to send, so you aren’t left staring at a blank box wondering how to start.'),
      p('A few things worth remembering, with or without an app:'),
      ol(
        'Late is normal. “I’ve been terrible at keeping in touch and I’m sorry” lands better than pretending two months didn’t happen.',
        'Specific beats grand. Ask about the thing they mentioned last time, not their whole life.',
        'No agenda needed. “Saw this and thought of you” is a complete message.',
        'A cancelled plan with warmth beats a kept plan with resentment.',
      ),
      p('The friendship rarely needs a perfect message. It needs a sent one.'),
    ],
  },
  {
    slug: 'your-notes-stay-yours',
    title: 'Your notes about your friends should stay yours',
    description: 'Notes about the people you love are the most personal data you own. Kinly’s privacy approach: your notes stay in your browser, with optional backup.',
    label: 'Privacy',
    date: '2026-11-14',
    summary: 'Notes about the people you love are the most personal data you own.',
    body: [
      p('The things you’d write in a relationship app are the most personal data you own. Not your photos or your passwords: the honest notes about the people you love. How the conversation actually felt. Who drains you. What you promised to ask about. You’d never post that publicly, so why would you store it on someone else’s server by default?'),
      p('Kinly is designed so your notes never have to leave your device. They’re saved in your browser, and you can export a backup, restore it, or delete everything from Settings, any time. If you choose to back up to an account, the copy is private to you. The optional AI features send only what a question needs, and only when you ask.'),
      p('A tool for your closest relationships has to be more careful with your words than your friends are. That’s the standard Kinly is built to.'),
    ],
  },
];

export const blogIndexMeta = {
  title: 'Blog — Kinly',
  description: 'Notes from building Kinly: why friendships drift, what to say when it’s been too long, and how Kinly keeps your notes private.',
};

export const postTitle = (post: BlogPost) => `${post.title} — Kinly`;

// About 200 words a minute, never less than one.
export function readingMinutes(post: BlogPost): number {
  const words = post.body.flatMap((block) => ('items' in block ? block.items : [block.text])).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatPostDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
