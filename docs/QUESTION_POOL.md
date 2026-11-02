# Kinly question pool

Kinly answers the Home question box for free, in the browser, with no AI. Two pieces do the work:

- `src/questions.ts` decides what **kind** of answer a question needs:
  - **say** — ready-made words
  - **cancel** — keep or reschedule
  - **talk** — things to bring up
  - **who** — who could use attention
  - **recall** — what you saved
  - **when** — last and next time
  - **decide** — should I…?
- `src/scripts.ts` holds the **"what do I say" library**: 19 situations, each with three ready-to-use
  lines and tips. Answers are personalised with the person's name, any time mentioned, their notes
  and the next plan.

`tests/questionPool.ts` holds 166 real-world phrasings of the questions people ask. Run
`npm run test:questions` to check every one still reaches the right answer. Add new phrasings
there whenever someone asks something Kinly gets wrong.

## Situations in the library

| Situation | Example question |
|---|---|
| late | What do I text when I'm going to be late for dinner? |
| money | How do I ask a friend to pay me back? |
| accept-apology | What do I say when Noah apologises to me? |
| no-reply | How do I follow up when Maya left me on read? |
| distance | How do I end a friendship kindly? |
| brief | What do I say if I can only stay 10 minutes? |
| cancel | How do I cancel plans last minute politely? |
| decline | How do I turn down a wedding invitation? |
| invite | How do I ask Elena to hang out? |
| apologise | How do I apologise for forgetting her birthday? |
| reconnect | What do I text a friend I haven't talked to in months? |
| boundary | How do I tell my sister I need some space? |
| check-in | What do I say to a friend who seems down lately? |
| support | What do I say to a friend whose dad passed away? |
| celebrate | What should I write to congratulate Samira on her promotion? |
| ask | How do I ask my neighbour to watch my cat? |
| miss | How do I tell my grandma I miss her? |
| thanks | How can I thank Arjun for helping me move? |
| hard-talk | How do I tell a friend they hurt my feelings? |

Questions that match no situation, such as "What do I say to my landlord about the rent?", get a
general three-step shape for hard messages. Kinly Plus AI can write a fuller answer.

## Results

- **166 of 166** pool questions route correctly.
- **Before tuning:** 89 of 136.
- **Fresh phrasings:** a set of 30 written after tuning scored **26 of 30** the first time. The 4 misses
  (e.g. "I'm 10 minutes late", "when my friend says sorry") were fixed and added to the pool.
  Expect roughly that accuracy on new wording, and keep adding misses to the pool.

## Sources the situations and wording draw on

- **SELF**, "The Art of Saying No to Invites": decline warmly, briefly and honestly; don't invent
  excuses. https://www.self.com/story/saying-no-to-invitations
- **Calm**, "How to cancel plans last minute": cancel early, give a brief honest reason, apologise,
  offer a specific new time, accept disappointment.
  https://www.calm.com/blog/how-to-cancel-plans-last-minute
- **What's Your Grief**, supporting a grieving friend: practical help over advice.
  https://whatsyourgrief.com/support-grieving-family-member-friend-6-principals/
- **HelpTexts**, the C.A.R.E. formula for grief texts ("I am here for whatever kind of day you are
  having").
  https://helptexts.com/blog/how-to-support-a-grieving-friend-over-text-use-the-c.a.r.e-formula/
- **SocialSelf**, "Don't know what to say?": ask questions and let them talk.
  https://socialself.com/blog/i-dont-know-what-to-say/
- Community questions (r/socialskills, r/Advice, r/Adulting, Quora) for how people actually
  phrase these questions, including asking for money back and ending friendships.

All script wording is Kinly's own, written in its calm, gender-neutral voice; no source text is
copied.
