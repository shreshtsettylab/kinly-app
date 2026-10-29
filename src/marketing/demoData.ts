// Prewritten, fictional examples for the public landing page. Nothing here reads the
// visitor's saved data; every answer mirrors what the real app produces for sample people.

export type Tone = 'go' | 'hold' | 'maybe' | 'info';
export type DemoAnswer = {
  id: string;
  question: string;
  kicker: string;
  tone: Tone;
  headline: string;
  reason: string;
  glance: { label: string; value: string }[];
  sections: { title: string; items: string[] }[];
  inApp: string;
};

export const demoAnswers: DemoAnswer[] = [
  {
    id: 'arjun',
    question: 'Should I meet Arjun tonight?',
    kicker: 'Your answer',
    tone: 'hold',
    headline: 'Not tonight',
    reason: 'You’re already seeing Arjun on Saturday, and you said your energy is low today. Save it for the walk.',
    glance: [
      { label: 'Last time together', value: 'Coffee · 12 days ago' },
      { label: 'How you felt', value: 'Felt good — “easy, lots of laughing”' },
      { label: 'Next plan', value: 'Walk in the park · Sat, 10:30 AM' },
    ],
    sections: [
      { title: 'Options', items: ['Keep Saturday’s walk and rest tonight.', 'Send a short message so Arjun knows you’re looking forward to it.'] },
      { title: 'Trade-offs', items: ['Meeting tonight keeps momentum, but two plans in three days may feel rushed.', 'Resting now protects your energy for a better Saturday.'] },
    ],
    inApp: 'Ask on Home. Your energy check-in and saved plans shape the verdict.',
  },
  {
    id: 'maya',
    question: 'What did I learn from my last meeting with Maya?',
    kicker: 'Looking back',
    tone: 'info',
    headline: 'Felt good last time',
    reason: 'Your last plan together was coffee, 9 days ago. Here’s what you saved.',
    glance: [
      { label: 'Last time together', value: 'Coffee with Maya · 9 days ago' },
      { label: 'How you felt', value: 'Felt good — “warm and easy”' },
      { label: 'Next plan', value: 'Dinner · tomorrow, 7:00 PM' },
    ],
    sections: [
      { title: 'What you saved', items: ['Your note: “Ask about the studio move. She’s been feeling stretched.”', 'Reflection: “She needs room to think out loud before she wants suggestions.”', 'Plan context: “Listening helped more than advice.”'] },
      { title: 'Things to bring up', items: ['“How is the studio move going?”', 'Hold back on advice unless Maya asks for it.'] },
    ],
    inApp: 'Ask on Home, or open Maya’s page to see the full timeline.',
  },
  {
    id: 'circle',
    question: 'How am I spending time with the people who matter?',
    kicker: 'Your circle this month',
    tone: 'info',
    headline: '2 of 5 people seen this month',
    reason: 'Time with Maya and Arjun has felt good. Noah and Samira may be drifting.',
    glance: [
      { label: 'Feels good with', value: 'Maya, Arjun' },
      { label: 'Might be drifting', value: 'Noah · 34 days · Samira · not yet' },
      { label: 'Last 30 days', value: '3 felt good · 1 mixed · 0 draining' },
    ],
    sections: [
      { title: 'Worth noticing', items: ['Your energy tends to dip after weeks with three or more plans.', 'A short message to Noah would keep things warm — no plan needed.'] },
    ],
    inApp: 'Shown on Home under “Your circle this month”, with patterns on your You page.',
  },
  {
    id: 'week',
    question: 'What should I prioritise this week?',
    kicker: 'This week',
    tone: 'go',
    headline: 'Rest first, then reach out to Noah',
    reason: 'You have three plans already and a rest goal this month. One message to Noah fits your intention to see family more.',
    glance: [
      { label: 'Active goals', value: 'Protect two quiet evenings · Call family weekly' },
      { label: 'Plans this week', value: 'Dinner with Maya · Walk with Arjun · Project catch-up' },
      { label: 'Weekly goal', value: '1 seen · 2 planned of 3 people' },
    ],
    sections: [
      { title: 'Suggested order', items: ['Keep Thursday evening free.', 'Message Noah — it has been 34 days.', 'Go to Saturday’s walk; skip adding anything new.'] },
    ],
    inApp: 'Today this comes from Goals, your weekly goal and “Who should I reach out to this week?”. A single combined weekly answer is still in development.',
  },
];

// The hero preview: one question, where the visitor's chosen energy changes the verdict.
export const heroVariants = {
  low: { tone: 'hold' as Tone, headline: 'Not tonight', reason: 'You’re seeing Arjun on Saturday and your energy is low. Save it for the walk.' },
  okay: { tone: 'maybe' as Tone, headline: 'Either way is fine', reason: 'Last time felt good, but you already have a plan on Saturday. Go only if it’s easy.' },
  good: { tone: 'go' as Tone, headline: 'Yes — keep it short', reason: 'Your energy is good and last time felt easy. A quick drink tonight is plenty before Saturday.' },
};
