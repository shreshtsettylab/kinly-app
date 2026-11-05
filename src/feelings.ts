// Reads a few lines someone wrote after time with a person, without AI and without sending
// anything anywhere: how it felt, how they felt afterwards, what came up, what to ask about next
// time, and anything they said they'd do. Every rule is plain and visible here, so the results
// can be explained and tested (tests/feelings.test.mts).

export type Tone = 'positive' | 'negative' | 'mixed' | 'neutral';
export type TextRead = {
  tone: Tone;
  warm: string[];
  draining: string[];
  energy: 'up' | 'down' | null;
  themes: string[];
  followUps: string[];
  promises: string[];
};

// Curly quotes become straight ones, so "didn’t" and "didn't" read the same.
export const normalise = (text: string) => text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');

// Phrases are checked before single words, and removed once matched, so "good time" counts once.
const warmPhrases = ['had a blast', 'had a great time', 'had a good time', 'had a lovely time', 'great time', 'good time', 'lovely time', 'felt heard', 'felt seen', 'felt understood', 'felt close', 'felt closer', 'so much fun', 'laughed so much', 'lost track of time', 'time flew', 'like old times', 'really needed that', 'needed this', 'needed that', 'deep conversation', 'deep chat', 'opened up', 'caught up properly', 'proper catch up', 'not bad', 'not too bad', 'left feeling better', 'felt lighter', 'felt like myself'];
const drainingPhrases = ['talked over me', 'on their phone', 'on her phone', 'on his phone', "couldn't wait to leave", 'wanted to leave', 'felt ignored', 'felt judged', 'felt left out', "didn't listen", "wasn't listening", "didn't ask about me", 'felt like a chore', 'one-sided', 'one sided', 'small talk', 'dragged on', 'ran late', 'showed up late', 'was late', 'cancelled last minute', 'canceled last minute', 'got into an argument', 'walking on eggshells', 'bit much'];

const warmWords = new Set(['good', 'great', 'lovely', 'happy', 'warm', 'close', 'fun', 'easy', 'calm', 'relaxed', 'relaxing', 'enjoyed', 'enjoyable', 'grateful', 'thankful', 'laughed', 'laughing', 'meaningful', 'nourishing', 'restored', 'restorative', 'energised', 'energized', 'energising', 'energizing', 'connected', 'peaceful', 'glad', 'wonderful', 'supported', 'comfortable', 'loved', 'love', 'amazing', 'awesome', 'nice', 'cozy', 'cosy', 'inspiring', 'inspired', 'hilarious', 'heard', 'understood', 'honest', 'supportive', 'kind', 'caring', 'sweet', 'beautiful', 'fantastic', 'brilliant', 'excellent', 'perfect', 'delightful', 'refreshing', 'refreshed', 'uplifting', 'uplifted', 'fulfilling', 'proud', 'excited', 'exciting', 'cheerful', 'joy', 'joyful', 'lucky', 'comforting', 'reassuring', 'encouraging', 'chill', 'bonded', 'bonding', 'reconnected', 'recharged', 'special', 'cute', 'chilled', 'safe']);
const drainingWords = new Set(['drained', 'draining', 'tired', 'exhausted', 'exhausting', 'rushed', 'stressed', 'stressful', 'tense', 'awkward', 'anxious', 'frustrated', 'frustrating', 'sad', 'upset', 'overwhelmed', 'overwhelming', 'argued', 'argument', 'distant', 'heavy', 'hurt', 'annoyed', 'lonely', 'uncomfortable', 'disappointed', 'disappointing', 'boring', 'bored', 'dull', 'cold', 'fight', 'fought', 'cried', 'annoying', 'irritated', 'irritating', 'ignored', 'judged', 'judgmental', 'judgemental', 'criticised', 'criticized', 'rude', 'dismissive', 'defensive', 'flaked', 'drama', 'toxic', 'guilty', 'jealous', 'bitter', 'resentful', 'angry', 'mad', 'forced', 'fake', 'superficial', 'shallow', 'distracted', 'stiff', 'uneasy', 'weird', 'cringe', 'cringey', 'regret', 'wiped', 'meh', 'bleh', 'pointless', 'difficult']);
// Words about how *you* felt afterwards, separate from how the time itself went.
const upWords = /\b(energi[sz]ed|recharged|refreshed|buzzing|uplifted|lighter|better after|left feeling better|felt like myself)\b/;
const downWords = /\b(drained|exhausted|wiped( out)?|tired|need(ed)? a nap|need(ed)? (a break|alone time|some space)|worn out|knackered|depleted)\b/;

const negators = new Set(['not', 'never', 'no', 'hardly', 'barely', 'without', 'nothing']);
const isNegator = (word: string) => negators.has(word) || word.endsWith("n't");

const themeRules: [string, RegExp][] = [
  ['Work', /\b(job|jobs|work|working|boss|office|promotion|interview|career|startup|laid off|layoffs?|manager|client|salary|hiring|resign(ed|ing)?|quit|appraisal|deadline|team)\b/],
  ['Health', /\b(doctor|hospital|surgery|sick|ill|illness|health|therapy|therapist|diagnos\w*|injur\w*|pregnan\w*|recover\w*|anxiety|depress\w*|medicine|scan|tests? results?|fever|pain)\b/],
  ['Family', /\b(mom|mum|mother|dad|father|parents?|sister|brother|siblings?|kids?|son|daughter|grand(ma|pa|mother|father)|family|in-laws|aunt|uncle|cousin)\b/],
  ['Love life', /\b(boyfriend|girlfriend|partner|husband|wife|dating|date|break ?up|broke up|divorce|engaged|engagement|crush|married|marriage|relationship)\b/],
  ['Home and moving', /\b(moving|move|moved|flat|apartment|house|rent|landlord|relocat\w*|new place|shifting|roommate|flatmate)\b/],
  ['Money', /\b(money|loan|debt|broke|savings|invest\w*|emi|bills?|expensive|afford)\b/],
  ['Travel', /\b(trip|travel\w*|vacation|holiday|flight|visa|abroad|backpacking)\b/],
  ['Milestones', /\b(birthday|wedding|anniversary|graduat\w*|exams?|results|launch\w*|baby|new job|housewarming)\b/],
  ['Stress', /\b(stress\w*|burn ?out|burnt out|overwhelm\w*|struggling|rough patch|hard time|anxious|panic)\b/],
  ['Hobbies', /\b(music|gig|concert|game|gaming|match|cricket|football|movie|film|books?|reading|cooking|running|marathon|hike|hiking|gym|yoga|painting)\b/],
];

// What makes a sentence worth bringing up next time: something coming up for them, or a note to self.
const futureMarker = /\b(next (week|month|year|weekend|time)|tomorrow|soon|this (weekend|week|month)|upcoming|in a (few|couple of) (days|weeks|months)|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|later this|by (january|february|march|april|may|june|july|august|september|october|november|december|the end of))\b/;
const futureVerb = /\b(is|are|was|were|'s|'re) (going to|gonna|about to|planning|thinking (of|about)|hoping|waiting (for|on)|starting|applying|moving|leaving|joining|getting|having)\b|\b(she|he|they|we)('ll| will)\b|\b(plans?|planning) to\b|\bhas (an?|the|her|his|their) (interview|exam|surgery|appointment|results|trip|wedding|test|operation|scan)\b/;
const eventNoun = /\b(interview|exams?|surgery|operation|appointment|results|wedding|trip|move|moving|launch|due date|baby|new job|scan|court|visa)\b/;
const noteToSelf = /\b(ask (her|him|them|about)|follow up|next time|remember to|check (on|in)|don't forget|find out)\b/;
const promise = /\b(i'll|i will|i promised|i said i'd|i said i would|i need to|i have to|i should|i owe|i offered to|i'm going to|remind me to|i must|i want to send|i'm meant to)\b/;

export function sentencesOf(text: string): string[] {
  return normalise(text)
    .split(/(?<=[.!?])\s+|\n+/)
    // "She's moving next month and I'll help her pack" holds two things: split before the promise.
    .flatMap((sentence) => sentence.split(/\s*[,;]?\s+\b(?:and|but|so)\s+(?=i'll\b|i will\b|i promised\b|i need to\b|i have to\b|i should\b|i owe\b|i offered\b|i said\b|i'm going to\b)/i))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 2);
}

const tidy = (sentence: string) => {
  const trimmed = sentence.replace(/^[-*•\s]+/, '').replace(/[\s,;:]+$/, '');
  const capped = trimmed.length > 140 ? `${trimmed.slice(0, 137).trimEnd()}…` : trimmed;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
};

export function readText(raw: string): TextRead {
  const text = normalise(raw).toLowerCase();
  const warm: string[] = [];
  const draining: string[] = [];
  let rest = ` ${text} `;
  const takePhrases = (phrases: string[], into: string[]) => phrases.forEach((phrase) => {
    const pattern = new RegExp(`(^|[^a-z'])((?:(?:not|never|didn't|wasn't|don't|isn't)\\s+)?)${phrase.replace(/[-]/g, '[- ]')}(?=[^a-z']|$)`, 'g');
    rest = rest.replace(pattern, (match, lead: string, negation: string) => {
      // "not bad" is itself the warm phrase; other negated phrases flip.
      if (negation && !phrase.startsWith('not')) (into === warm ? draining : warm).push(`${negation}${phrase}`.trim());
      else into.push(phrase);
      return `${lead} `;
    });
  });
  takePhrases(warmPhrases, warm);
  takePhrases(drainingPhrases, draining);

  const words = rest.match(/[a-z0-9']+/g) || [];
  words.forEach((word, index) => {
    const before = words.slice(Math.max(0, index - 3), index);
    // "not very good", "wasn't that fun": a negator within the three words before flips the word,
    // unless a "but" sits between them ("not long, but fun").
    const butAt = before.lastIndexOf('but');
    const negated = before.slice(butAt + 1).some(isNegator);
    if (warmWords.has(word)) (negated ? draining : warm).push(negated ? `not ${word}` : word);
    else if (drainingWords.has(word)) (negated ? warm : draining).push(negated ? `not ${word}` : word);
  });

  // One side clearly outweighing the other wins; otherwise both together read as mixed.
  const tone: Tone = warm.length && draining.length
    ? warm.length >= draining.length * 2 ? 'positive' : draining.length >= warm.length * 2 ? 'negative' : 'mixed'
    : warm.length ? 'positive' : draining.length ? 'negative' : 'neutral';

  const up = upWords.test(text);
  const down = downWords.test(text) && !/\b(not|wasn't|didn't feel) (tired|drained|exhausted)\b/.test(text);
  const energy = up && !down ? 'up' : down && !up ? 'down' : null;

  const themes = themeRules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);

  const followUps: string[] = [];
  const promises: string[] = [];
  sentencesOf(raw).forEach((sentence) => {
    const lower = sentence.toLowerCase();
    if (promise.test(lower)) promises.push(tidy(sentence));
    else if (noteToSelf.test(lower) || futureVerb.test(lower) || (futureMarker.test(lower) && !/^i\b/.test(lower)) || (eventNoun.test(lower) && /\b(she|he|they|her|his|their)\b/.test(lower))) followUps.push(tidy(sentence));
  });

  return { tone, warm, draining, energy, themes, followUps: [...new Set(followUps)].slice(0, 4), promises: [...new Set(promises)].slice(0, 3) };
}
