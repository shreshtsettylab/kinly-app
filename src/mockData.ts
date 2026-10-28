export type Person = {
  id: string;
  name: string;
  initials: string;
  relationship: string;
  detail: string;
  color: string;
  nextPlan?: string;
  nextPlanDate?: string;
  note: string;
};

export const people: Person[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    initials: 'MC',
    relationship: 'Close friend',
    detail: 'A thoughtful, steady presence in your life',
    color: '#526579',
    nextPlan: 'Dinner at Lupa',
    nextPlanDate: 'Tomorrow, 7:00 PM',
    note: 'Ask about the studio move. She mentioned feeling stretched lately.',
  },
  {
    id: 'arjun',
    name: 'Arjun Mehta',
    initials: 'AM',
    relationship: 'Friend',
    detail: 'Usually energising and easy to be around',
    color: '#3A5470',
    nextPlan: 'Walk in Prospect Park',
    nextPlanDate: 'Sat, 10:30 AM',
    note: 'Keep the morning unhurried. A walk feels better than a full afternoon plan.',
  },
  {
    id: 'elena',
    name: 'Elena Rossi',
    initials: 'ER',
    relationship: 'Colleague',
    detail: 'A creative collaborator from the design team',
    color: '#3D5060',
    nextPlan: 'Project catch-up',
    nextPlanDate: 'Mon, 2:00 PM',
    note: 'Bring the first draft and leave ten minutes for the broader conversation.',
  },
  {
    id: 'noah',
    name: 'Noah Williams',
    initials: 'NW',
    relationship: 'Sibling',
    detail: 'Family, with a warm but busy rhythm',
    color: '#4D6474',
    nextPlan: 'Sunday lunch',
    nextPlanDate: 'Sun, 1:00 PM',
    note: 'You want to be present without making the lunch too structured.',
  },
  {
    id: 'samira',
    name: 'Samira Patel',
    initials: 'SP',
    relationship: 'Mentor',
    detail: 'A grounding perspective when you need one',
    color: '#2E3C4D',
    nextPlanDate: undefined,
    note: 'Thank her for the recommendation she shared last month.',
  },
];

export const upcomingPlans = [
  { id: 1, title: 'Dinner at Lupa', person: 'Maya Chen', date: 'Tomorrow', time: '7:00 PM', kind: 'Social' },
  { id: 2, title: 'Walk in Prospect Park', person: 'Arjun Mehta', date: 'Saturday', time: '10:30 AM', kind: 'Wellbeing' },
  { id: 3, title: 'Project catch-up', person: 'Elena Rossi', date: 'Monday', time: '2:00 PM', kind: 'Work' },
];
