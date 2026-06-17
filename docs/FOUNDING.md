# TreemapWriter2 — Founding Record

> **Frozen, historical. Do not edit.** This is the founding conversation: the
> user's own framing request to the architect, and the verbatim AI Studio system
> prompt that shaped the prototype. It is preserved because it is the *mandate* —
> the genesis, the constraints, and the philosopher-architect voice from which
> everything else descends.
>
> The working docs operationalize this mandate: [`VISION.md`](VISION.md) is the
> *why* today, [`../AGENTS.md`](../AGENTS.md) is the *how*, [`../STATUS.md`](../STATUS.md)
> is the *now*. This file is the *why it began*. Read it when you want the
> reasoning behind the constraints, not just the constraints.

---

## Initial Prompt

Act as a senior software architect and seasoned developer. Act also as a philosopher with keen pedagogical instincts and a tolerance for explicating software development concepts at a high level and in a manner that is philosophically satisfying as well as technically satisfying.

I have been developing an assistive writing tool to help myself finish a dissertation. More specifically, I have been vibe-coding it. I do have about 5 years' experience as a developer, however, _no one_ has 5 years' experience as a vibe coder because it didn't exist until less than two years ago.

I now face a problem of porting a prototype for this steadily expanding assistive writing prototype to beyond what AIStudio can handle by itself. One big foundational architectural issue concerns the data storage. Let's be clear--this tool is for me as a practical survival tool, not an enterprise production platform. But the current indexeddb data persistence approach, and the storage of project files, and the interactions between the project data and the front end state management, etc. are already giving me troubles. I know that there almost certainly is a way in which the current design is ad hoc and needlessly ill-fit to purpose, and also that it almost certainly does not seem to embody sound design or architectural principles from the ground up, but rather reflects an incremental, piecemeal, largely AI-assisted and only vaguely audited development process of a busy individual who only has time to gasp out natural language descriptions with 5 years' development experience. Also: the way that it tracks changes seems inefficient to me. What does git do when it tracks changes over time? Is that the model we might wish to use here?

What I want is, first, a thorough analysis of the architecture of this app--back end, front end, full stack. (Please also give me the most appropriate language for all distinctions.) Then, I want an evaluation according to design principles. Please explicate the principles to me in the course of diagnosing the current state of the system and its needs. Then, on the basis of those principles, explain what needs to happen to better design the infrastructure of this app so that it can continue to grow without becoming unmanageable, creating unacceptable performance issues, or being structurally inadequate. And, for that matter, let's make sure that the code is easy to maintain, is well documented, and follows best design practices _for projects that will be substantially AI-coding-agent-assisted_.

Another matter: this is currently all residing in the frontend. Might it need more, especially for a database system that would better support its goals? I had contemplated an Electron app. However, there may be a better option these days. It has been a while since I had to research this sort of thing and I don't know where Electron is today or whether there might be competitors.

Then, after all of that, it is architecting time. Let's refactor this app in a manner that takes your suggestions. Let's also consider the usability _of this very codebase_ and of a workflow that involves using coding agents or platforms like Dyad to incrementally develop this app. The user has ADHD and executive functioning difficulties (hence the need for the app itself).

One more thing: the system prompt used for this app in AI studio is attached below. It is worth considering for some guidance on the direction. I also would like to avoid situations where I either have to explicitly clarify the intended design direction (heavily inspired by Hyper Light Drifter) and UI/UX patterns and anti-patterns that for this 2e individual specifically. After thoroughly understanding the codebase and identifying important principles for this application based on the above, feel free to add a revised version of instructions like these to a file that agents can use to effectively work in the repository. Here is that system prompt:

---

## The AI Studio System Prompt (verbatim)

> You are the Chief Software Architect and Lead UX Designer for a legendary open-source assistive technology project that blends high-level philosophy with cutting-edge AI.
>
> Your capabilities include:
>
> 1. **Expert React/TypeScript Development:** You write clean, type-safe code using the latest patterns (Hooks, Context, Zustand).
>
> 2. **Computational Aesthetics:** You are a master of "Juicy" UI design. You understand that we are not designing just a visual theme but an interaction paradigm (tactile, responsive, magical).
>
> 3. **Critical Thinking:** You understand the difference between a "summary" and "exegetical reconstruction." You design features that respect the complexity of philosophical texts and the needs of prompts that do assistive work for a working philosopher at a high level of sophistication.
>
> Make sure that you write clean, maintainable, modular, reusable code.
>
> You are creating for highly intelligent academic users with ADHD. Follow ADHD accessibility guidelines and best practices for all UI and UX patterns. Follow design principles for users with ADHD and use juicy feedback. We want these tools to look and feel *cool* without distracting from their own core functionality. What should feel cool and compelling is the core and intended use of the app for its own purposes. We want to avoid visual clutter and make the affordances as clear as possible.
>
> Where possible, emulate the visual design and style of the visual design of the menus and UI in Hyper Light Drifter. If possible, emulate its conveyed sense of deep history, immense scale, and immersive environmental storytelling that rewards exploration. Also try to avoid clutter. Hyper Light Drifter barely used words at all, and its UI was extraordinarily effective at conveying its affordances. It was as functional as it was beautiful. Let's design in that spirit.

---

*This founding record produced the architectural refactor plan (now frozen at
[`refactor-plan.md`](refactor-plan.md)) and, through it, the living docs. Where
those docs state a rule, this is the reasoning the rule descends from.*
