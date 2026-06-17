export {
  DEFAULT_PROMPTS_CONFIG,
  normalizePromptsConfig,
  resolvePromptsConfig,
  diffPromptsConfig,
} from "../services/prompts";

export const SECTION_FUNCTIONS = [
  { id: 'introduce', label: 'Introduce', desc: 'Sets up problem space, motivates what follows' },
  { id: 'explicate', label: 'Explicate', desc: 'Unpacks a concept, theory, or framework' },
  { id: 'argue', label: 'Argue', desc: 'Advances a claim with supporting reasons' },
  { id: 'compare', label: 'Compare', desc: 'Puts positions in productive tension' },
  { id: 'critique', label: 'Critique', desc: 'Identifies problems with a position' },
  { id: 'synthesize', label: 'Synthesize', desc: 'Integrates multiple strands' },
  { id: 'apply', label: 'Apply', desc: 'Uses a framework to analyze a case' },
  { id: 'evaluate', label: 'Evaluate', desc: 'Assesses adequacy against criteria' },
  { id: 'narrate', label: 'Narrate', desc: 'Traces a development' },
  { id: 'transition', label: 'Transition', desc: 'Bridges between major parts' },
] as const;

/**
 * Build the diagnostic evaluation prompt at runtime.
 * This replaces the old single-shot "evaluate against goals" approach
 * with a structured move-by-move diagnostic.
 */
export function buildDiagnosticPrompt(params: {
  baseInstruction: string;
  personaInstruction: string;
  customInstruction: string;
  sectionTitle: string;
  sectionFunction: string;
  mainClaim: string;
  requiredMoves: { id: string; description: string }[];
  incomingContext: string[];
  outgoingCommitments: string[];
  scope: string;
  content: string;
}): string {
  const movesList = params.requiredMoves
    .map((m, i) => `  ${i + 1}. [${m.id}] ${m.description}`)
    .join("\n");

  const incoming = params.incomingContext.length > 0
    ? params.incomingContext.map(c => `  - ${c}`).join("\n")
    : "  (none specified)";

  const outgoing = params.outgoingCommitments.length > 0
    ? params.outgoingCommitments.map(c => `  - ${c}`).join("\n")
    : "  (none specified)";

  return [
    params.baseInstruction,
    "",
    params.personaInstruction,
    "",
    params.customInstruction ? `ADDITIONAL INSTRUCTION: ${params.customInstruction}` : "",
    "",
    `SECTION: "${params.sectionTitle}"`,
    `FUNCTION: ${params.sectionFunction}`,
    `MAIN CLAIM: ${params.mainClaim}`,
    "",
    "REQUIRED MOVES (check each one):",
    movesList,
    "",
    "INCOMING CONTEXT (what prior sections should have established):",
    incoming,
    "",
    "OUTGOING COMMITMENTS (what this section must establish for later):",
    outgoing,
    "",
    `CONTEXT SCOPE: ${params.scope}`,
    "",
    "TEXT TO EVALUATE:",
    "---",
    params.content,
    "---"
  ].filter(Boolean).join("\n");
}


export const DEFAULT_MARKDOWN = `
# 0. Introduction

> We compare life to a traveler faring forth. We may consider him first at a moment where his activity is confident, straightforward, organized. He marches on giving no direct attention to his path, nor thinking of his destination. Abruptly he is pulled up, arrested. Something is going wrong in his activity. From the standpoint of an onlooker, he has met an obstacle which must be overcome before his behaviour can be unified into a successful ongoing. From his own standpoint, there is shock, confusion, perturbation, uncertainty. For the moment he doesn't know what hit him, as we say, nor where he is going (Dewey 1922, p.127).

What happens next?

Humans and other organisms face new problems for which they are not prepared. There *will be* a new threat, a new opportunity, a new demand. When they arrive, they will be *novel adaptive problems*. What can the organism do in the face of them? Sometimes the organism is helpless in the face of these new demands, or fails to recognize them. Other times, though, intelligent organisms seem to be able to *invent* or *discover* an adequate response for the first time, and thereby solve the problem. But what really *is* this capacity for invention or discovery? [^1] What is its nature, and what are its limits?

[^1]: In this document, there is some fluidity in the terms and phrasings I use (e.g. "productive thinking", "problem solving", "inquiry"). Where I do so, I ask the reader to try to read as though I am following a thread, rather than changing the subject. This partly is because I am interacting with writers who also wrote in this way, but moreso partly because I am still trying to sort out the basic distinctions at play.

This dissertation is about what organisms can do when faced with new problem situations they are not presently equipped to deal with, and which they do not understand. Specifically, it aims to reconstruct an hypothesis once advanced by the Gestalt Psychologists and John Dewey that intelligent organisms have some capacity for taking direct action to develop *insight* into the source of the new demands of their life situations.

The Gestalt theorists were among the first to investigate this problem experimentally. In a series of experiments reported in Köhler's *Mentality of Apes* (1917/1925), Köhler demonstrated that apes were capable of behaving with *insight*, and of inventing or discovering solutions to new problem situations. When apes initially *lacked* insight sufficient to solve a problem, they showed some capacity to take direct action to *develop* it. They would *survey* the situation; failed attempts would often be more like "*good errors*" or *reasonable hypotheses* than blind or random trial-and-error behaviour. Often, after a period of such trying, they would more or less suddenly respond insightfully and successfully. While the observational facts are not disputed today, and continue to be replicated in many non-human animals as well as humans (Osuna-Mascaró & Auersperg 2021, Wiley & Danek 2024), it is less well-known what theoretical problems the Gestalt theorists thought these observations posed for the psychologist, and the solution they proposed.

The Gestalt theorists used this data draw a contrast between *reproductive* and *productive* strategies for explaining intelligent behaviour. Reproductive strategies explain adaptive behaviour in terms of reproductions of responses that were successful in the past, whether in its individual learning history or in the evolutionary history of its species. Productive strategies, on the other hand, center around how responses can arise *for the first time*. In lieu of past successes to reproduce, perhaps there is something in the present sufficient to give rise to the first success. Perhaps the first success can develop under the stress of the concrete problem situation itself. To put it another way, when you have an intelligent organism in a problem situation, the features of the *present* situation that *make* it a problem situation are sufficient to *guide* and *drive* the discovery or invention of a successful response for the first time. To put it still another way, problem situations qua problem situations are inherently *unstable*, and it is the psychologist's job to identify, *causally*, the principles of organization which make the invention or discovery the path of least resistance. This is what Köhler at one time called a “theory of direct field action.” (Kohler 1946, p.348) The "main question for a problem of thinking" then becomes: *"...How does a problem find its solution, how does the stress set up by a question contrive to create those conditions which will make the answer possible?"* (Koffka 1935, p.625)

The above formulation is vague, but the Gestalt theorists developed and refined this approach into a causal theory. More importantly, they *had* a theory of insight, and of how an organism could develop it in new problem situation. Evidently it was a *productive* theory, as the short but highly impactful career of experimental Gestalt work on productive thinking and insight attests. Impactful as the classical Gestalt theory of insight proved to be, it seemed to pull something of a bait-and-switch. The Gestalt theorists could not find the organizational processes that they used to describe and explain insight and intelligent achievement in the organism-environment system, and so they posited that the world we develop direct insight into was actually a reconstructed *phenomenal world*, embodied in a brain field process. In doing so, they made it clear that their principles for explaining insight and intelligent achievement did not directly address the original question in its adaptational flavour, which was about what an *organism* can do to directly respond to the new demands *of its life situation*--the one that makes the real functional demands, upon which its health, functioning, and fate depend. The success of a mechanism like this would only be as good as the organism's ability to construct an internal phenomenal counterpart of *not-yet-understood* problem situations. I call this *The Two-World Problem*. It is hard to resist a resulting picture of the problem solving process as one of looking inwards and scrutinizing one's own inner world, rather than one of an organism directly exploring and discovering problems in its life situation.

Nowadays, the idea that organisms can come into direct contact with meaning and value in their environments is pursued under an active research program. This is the *ecological approach* of James and Eleanor Gibson (J. Gibson 1966, 1979/2014; E. Gibson 1969; E. Gibson & Pick 2000) and those who have followed them. Their approach took the two-world picture of the Gestalt theorists as a point of departure. On their approach, the directly experienced meaning and value is meaning and value *of the environment* (its *affordances*). This approach is explicitly designed to *avoid* the Two-World Problem, and it employs ingenious conceptual innovations to do so. This has earned their approach both notoriety and acclaim for its non- or anti- representational character.

However, the ecological approach is regularly charged with a criticism leveled against the more *radical* strains of embodied cognition (or "4E cognition"). It is a widespread attitude that "real cognition"--which would include problem solving and *certainly* insight--is *representation hungry* (Clark & Toribio 1994). As a non-representational approach, ecological psychology thus faces *the 'scaling up' problem*. At times, 4E cognition theorists have colluded with information-processing theories on this point, opting either to not work on thinking and problem solving, or arguing for their elimination as legitimate problems of psychology. Yet the ecological approach shares a direct lineage with Gestalt psychology and with American pragmatism, with its naturalistic emphasis on *concrete problems* as the locus of philosophical investigation. Why is it then that they should have difficulty addressing the question of *how organisms solve their problems*? How did that come to be?

This is an interesting historical question that I hope I will be able to cast some light on. But more importantly, I want to see whether *we* can overcome the difficulty and have it both ways--whether we can adapt the Gestalt theory of insight and intelligent achievement without falling into the Two-World Problem.

To return to the epigraph: John Dewey didn't end on that cliffhanger. One of his most long-standing projects was to develop a naturalistic theory of inquiry which accounted for *how humans can solve their problems* (Dewey 1986, 1910, 1916, 1925, 1927, 1938). An adequate and genuinely meliorative account of this process of inquiry would have to do justice to the earliest phases of inquiry, crucially including those in which the situation is vague, uncertain, confused, unclear (Dewey 1930; Dewey & Bentley 1948, Garrison 1996, Pappas 2016, Henne 2022, 2023); through the genesis of the earliest inchoate and naive ideas, through their development in exploration, observation and reflection, to a conclusive judgment. The story he tells is not short, but as I am reading it, it succeeds in furnishing a conceptual framework within which the basic problems of insight and intelligent achievement posed by the Gestalt theorists can be addressed, but without falling into the Two-World Problem.

However, his theory has not yet been rendered into an experimental research program of its own. Few have argued more emphatically than Dewey himself that conceptual frameworks are only as good as their capacity to function in solving problems. If a bridge can be made between Dewey's theory and the more operational theoretical concepts of the Gestalt theorists and ecological psychologists, we may be able to use his theory of inquiry to unify the Gestalt and Ecological approaches, and reciprocally to adapt the methods of the Gestalt and Ecological approaches to develop Dewey's theory of inquiry into an experimental psychology of inquiry.

This is how it seems: the classical Gestalt theorists have a powerful theory and experimental psychology of insight and intelligent achievement, but succumb to the Two-World Problem. The ecological psychologists circumvent the Two-World Problem, but lack a fully developed theory of insight and intelligent achievement. Dewey has developed a coherent conceptual framework that can address insight and intelligent achievement and while avoiding the Two-World Problem, but lacks an experimental research program. It seems that we have the ingredients to synthesize these contributions. In this dissertation, I will draw from classical Gestalt psychology, ecological psychology, and John Dewey's functional theory of inquiry to develop a naturalistic theory of insight and intelligent achievement that avoids the Two-World Problem that is directly tied to operational and experimental methods.

| Approach                       | Theory of Insight? | Avoids The Two-World Problem? | Experimental Program? |
| ------------------------------ | ------------------ | ----------------------------- | --------------------- |
| Classical Gestalt Psychology   | ✅                  | ❌                             | ✅                     |
| Ecological Psychology          | ❌                  | ✅                             | ✅                     |
| John Dewey's Theory of Inquiry | ✅                  | ✅                             | ❌                     |
| **Vital Integration**          | ✅                  | ✅                             | ✅                     |

# 1. Achievements of Insight: Gestalt Psychology's Gadfly Data

The Gestalt theorists introduced the notion of *insight*. Initially this was a descriptive notion, for a kind of behaviour that couldn't be reduced to another type. They demonstrated at length that this kind of behaviour was exhibited by certain anthropoids and other non-human animals. They later argued that insight was also present as a pervasive feature of experience, roughly synonymous with *experienced situational meaning*. It was argued forcefully that insight was *present in* and *the product of* learning and problem solving. The Gestalt theorists supported these claims with creative experiments that are still frequently used and adapted, as well as vigorous argumentation. But to the Gestalt theorists, these demonstrations of insight were only "data that contained a new problem. At the same time, the new problem pointed toward new solutions." (Koffka 1935, p.628) What was the new problem they argued it posed, and what was the solution it pointed to?

In this chapter, I will progressively develop an analysis of the Gestalt work on *achievements of insight*. The strategy I will undertake is as follows: I will reconstruct the Gestalt concept of insight by roughly chronologically tracing its development in major writings of the original Gestalt theorists of the "Berlin School" (Max Wertheimer, Wolfgang Köhler, Kurt Koffka), as well as some of their influential immediate students. Then I will produce an analysis of the behavioural and phenomenal characteristics of insight, and the ways that they show up in problem solving and learning. Finally, I will formulate two problems that are entangled with each other: *The Problem of Insight* and *The Problem of Achievement*. A theory of insight which is adequate to the basic data of insight needs to adequately address both.

## 1.1 Historical Development of the Insight Concept
In this section, I will trace historical development of the insight concept in the major works of the three founding Gestalt theorists. Major historical secondary literature will be consulted throughout. Here is a limited sample of highlights essential to the case to be developed:

### 1.1.2 Wertheimer: Precedents in "the First Gestalt Paper"
I describe the precedents of the insight concept in what secondary literature (King & Michael 2005, Ash 1995, Harrington 1996) has come to identify as the first published work containing the matured Gestalt-theoretic outlook--not in a work on perception, but in comparative numerical cognition (Wertheimer 1912/1938). Key relevant ideas here include that *natural groupings and units* tend to form in the context of concrete functional tasks; and that these structures *predetermine* sensible operations on them.

### 1.1.3 Kohler's Introduction of Insight
Insight is first introduced explicitly In Wolfgang Köhler's *Mentality of Apes* (1917/1925) we get the original introduction of the term *insight* and *achievements of insight*, and extended reports on a sequence of experiments probing the intelligent capacities of apes.

In it we get a distinction between *Type-A behaviour* and *Type-B behaviour* as examples of behaviour demonstrating insight into the problem situation, and behaviour that does not, respectively. This distinction is easily observed using tasks constructed using "detour" or "roundabout" methods. While a theory of Type-A behaviour was not proposed, it was argued that "*solutions* showing insight are of the same nature as the structure of the situations, in so far as they are in dynamic processes *co-ordinated with* the situation" (Köhler 1925/2020, p.268).
#### Against Associationism

#### Roundabout Methods

#### "Imitations of Chance" and "Genuine Solutions"

#### Insight

##### Genuine Achievements

##### Good Errors

### Kurt Koffka's Growth of the Mind and Mental Development
In his 1925a *Growth of the Mind* and in abbreviated form in his "Mental Development" (1925b) Kurt Koffka makes a number of important contributions. The first is a theory of instinctive and reflex behaviour. These are proposed not to be essentially fixed in character, but to have the character of dynamic *adjustment* or *adaptation*. They are argued to be more like *incomplete* processes exhibiting tendencies towards closure. Koffka then poses
#### *The Problem of Learning*,
which he splits into two problems:
##### *The Problem of Memory*,
which is to determine how performances of an organism can be affected by past performances, and
##### *The Problem of Achievement*,
which is to determine how the first performances come about. Critically, *achievements of insight* are argued to involve essentially the same adjustive incomplete process as instinctive and reflex behaviours, with the only difference being that in this case, overt action is preceded by different intermediate processes (i.e., thinking, problem solving, intelligent learning).

---

### Kohler's Gestalt Psychology: an Introduction (1929)
Köhler's *Introduction to Gestalt Psychology* (1929/1946) was written after the Gestalt approach had begun to be taken up in American psychology. It was written with the intent to present the Gestalt approach to an American audience, and clarify misconceptions that had developed about it. Some of these clarifications about insight and behaviour likely still sound shocking, and they are crucial for this analysis. Kohler, using copious common examples, argues that insight is *not essentially a matter of thinking or intellectual achievement*. It is generally present in emotional reactions and in impulses towards action too (pp.348-349). It is present whenever, in experience, one part of the situation is directly experienced as being *because of*, or *as a sensible response to*, some other part of the situation. Importantly, this includes experiencing our own actions and impulses to action as something that *follows from the given concrete situation*. Not only the *what*, but also much of "the how and the why" are immediately experienced too (1929/1946, p.349).

### Kohler's elaborations in *On the Nature of Intelligence* (1930)
In a paper whose English translation is given the title "*The Nature of Intelligence*," (1930/1971) Köhler draws a distinction between two aspects of intelligent behaviour--behaviour demonstrating insight per se, and *inventions* or *discoveries* or *specific accomplishments*. While these are distinct, for good methodological reasons they are often investigated together. Some important theoretical arguments are made against blind variation mechanisms and strictly reproductive theories of achievements of insight, and *for* a view based of spontaneous self-organization of the kind made familiar in Wertheimer's principles of visual organization (Wertheimer 1923/2012). This is sketched in more detail in (1926): Seen objects are not "purely optical entities under most conditions of life"--we tend to spontaneously group things in their *functional value*, too; and "not necessarily so that objects of equal functional value are grouped together, rather more so frequently that objects which *belong* together in one actual practical task or performance stand out together in the field" (1926).

#### Koffka's Principles of Gestalt Psychology (1935)
Koffka's 1935 tome, *Principles of Gestalt Psychology*, is a formidable systematization of the Gestalt experimental and theoretical work, including work on insight and thinking. Like Kohler 1929/1946, it makes a number of clarifications and attempts to correct misconceptions.

### The Gestalt Conception of Parts and Wholes
In Wertheimer's *On Truth* (1935/1961), he introduces some distinctions and formalisms that will be used where it helps to clarify issues and arguments. In it he distinguishes between *piecemeal truth* and *real truth*. A person hires someone to steal something from someone's desk. If asked by a prosecutor "did you take the article?" according to a standard correspondence theory of truth, the first man's "I did not take it from the desk" was a true statement. This "corresponds with reality; but with a piecemeal reality, torn from its context, seen as a piece, blind to its connections in part of a related whole... The real truth must take account of any statement, and equally of its corresponding object, as parts of related wholes." (p.21). This applies to statements, but also to objects. He goes on to argue that we need to distinguish between objects as *pieces* $|a|$, objects as a part of its whole $\\Bigg|{a\\phantom{bc} \\atop abc}$, and the object as part of another whole $\\Bigg|{a\\phantom{mn} \\atop amn}$. When you put two objects in a real relationship as parts of a whole, then you need to consider the question of their alteration: $\\left\\lvert a\\right\\rvert \\ + \\ \\left\\lvert b\\right\\rvert \\rightarrow \\Bigg|{a\\phantom{b} \\atop ab} \\ + \\ \\Bigg|{b\\phantom{a} \\atop ab}$; and likewise when you remove an object from its whole context, it becomes something different from what it was before it was so isolated: $\\Bigg[\\Bigg|{a\\phantom{b} \\atop ab}+ \\Bigg|{b\\phantom{a} \\atop ab} \\Bigg] - \\Bigg|{b\\phantom{a} \\atop ab} = \\Bigg|{a \\atop a} = \\left\\lvert a\\right\\rvert$. This notation is useful and will be utilized where it helps to clarify issues and arguments.

In Köhler's *The Place of Value in the World of Facts,* (1938) the entire essay is premised as a kind of apology for the reality of insight and its application to significant scientific and human problems. Directly experienced value, need, demand, etc. *of* a situation are collectively considered under the term *requiredness*. An analysis and naturalized theory of *requiredness* is developed in light of various then-prominent ethical positions.

Wertheimer's posthumous *Productive Thinking* (1945/1959) develops a range of explanatory concepts in discussing processes of achievement in concrete cases of thinking. His closing theoretical section frames the problem for a theory of productive thinking which I will adapt in section 1.2.
## 1.2 A Descriptive Analysis of Intelligent Achievements
In section 1.2, I will systematically summarize the behavioural and phenomenal characteristics of intelligent achievements, and examine how insight is a pervasive (and not, e.g., marginal or exotic) facet of processes of invention or discovery. As recurring case studies of insight in problem solving, I will use Köhler's comparative tasks (Köhler 1925,1993) Maier's Two Strings Task (1931), and Wertheimer's Parallelogram problem and A/B method (1945, Luchins & Luchins 1970). The proverb that "the burnt child shuns the flame" has been a recurring "case study" for naturalistic theories of adapted behaviour since Descartes, and I will recur to it throughout too.

At this preliminary stage, I can cite the following characteristics:
### 1.2.1 Descriptive Analysis of Insight
Behaviourally, insight is observable in *type-A behaviour*--that is, behaviour which is *coordinated with* and *directly utilizes* the relevant structure of a situation. This is indicated by Prägnanz characteristics--e.g. *good continuation*, *closure*, *maximum efficiency*, *minimum complexity* with respect to the structural requirements of the situation; and is *contraindicated* by type-B characteristics, i.e. a "zig-zag" character, being comprised of part-processes that are intrinsically unrelated to each other and to the objective. Insight is also observable in processes of productive thinking (see below).

Phenomenally, insight amounts to direct experience of intrinsic situational meaning. This centrally involves *requiredness*--which includes one part of the experienced situation demanding or inviting some more or less specific alteration, or of events in one more or less specific part of the situation being the *cause* of or *reason for* alterations throughout the field. This can involve relations among parts of the environment as well as relations between the environment and oneself. Importantly it includes not just what one is doing, but much of "the *how* and the *why*" (Köhler 1929/1947, p.349). Köhler's analysis of requiredness in *The Place of Value in the World of Facts* (1938) provides the most thorough analysis of requiredness, and will be adopted for this purpose.

Phenomenal characteristics are publicly observable in behaviour, too. As the Gestalt theorists argued, there are methods of observing phenomenal characteristics of experience in behaviour ("conduct" in contradistinction to "behaviour") (Koffka 1925a). Besides this, there are observable behavioural characteristics of perplexity, doubt, and trying to understand a problem, and famously, moments of achievement can often be observationally distinguished (e.g. the "*aha!* moments").

### 1.2.2 Descriptive Analysis of Productive Thinking
The analysis of productive thinking will pick up from Wertheimer's concluding theoretical discussion in *Productive Thinking* (1945/2020). A common case of successful productive thinking looks like this:

>Generally speaking, there is first a situation
>	S1, the situation in which the actual thought process starts,
>		and then, after a number of steps,
>	S2, in which the process ends, the problem is solved.
>
>Let us consider the nature of situation 1 and situation 2 by comparing them, and let us then consider what goes on between, how and why. Clearly the process is a transition, a change from $S1$ into $S2$. $S1$, as compared with $S2$, is structurally incomplete, involves a gap or a structural trouble, whereas $S2$ is in these respects structurally better, the gap is filled adequately, the structural trouble has disappeared; it is sensibly complete as against $S1$. When the problem is realized, $S1$ contains structural strains and stresses that are resolved in $S2$. (p.193)

![[Productive Thinking S1 and S2 Question about transition]]

What can we say in general about the dynamics of this transition? Do the structural gaps and difficulties *just happen to* end up completed? Type-B or *blind* thinking would have this character. But in productive thinking, the dynamics of the transition have something intrinsically to do with the character of the gaps and difficulties given at $S_{1}$. Wertheimer states the Gestalt hypothesis like this:

>The thesis is that the very character of the steps, of the operations, of the changes between $S1$ and $S2$ springs from the nature of the vectors set up in these structural troubles in the direction of helping the situation, of straightening it out structurally. (Wertheimer 1945/2020, p.193-194).

In other words, the transition from the structural gaps, troubles, etc. at $S_{1}$ is a process that is *guided and driven by* those very structural features. "Structural reasons become causes in the process." (1945/2020, p.195) At this point, the descriptive theory begins to give way to a causal one. It is also clear that the entire process is shot through with *insight* as defined above. If the organism's process of thinking is guided and driven by *insight* into the structural gaps and difficulties at $S_{1}$ in the direction of sorting it out, then a theory of productive thinking requires a theory of insight.
### 1.2.3 Type-A Response
The original insight data in Köhler's studies, and the experiments considered throughout, took *Type-A behaviour* as a criterion of insight. But as noted, type-A behaviour is also manifest in behaviour that doesn't appear directly in a productive thought process at all; indeed it is present in very habitual and even instinctive kinds of behaviour. Following Koffka 1925a,1925b, instinctive behaviour and behaviour that mediated by a productive thought process share a common feature, namely that of being *fitted to* or *appropriate to* a situational demand. This is quite similar to what Wertheimer said of productive thinking. Both productive thinking and type-A responses share this characteristic. I believe this is because productive thinking *is* part of a type-A response, as described below.
### 1.2.4 Intelligent Achievement
The term "intelligent achievement" is *currently* the term I have landed on to designate the whole process of developing a developing a type-A response to a problem situation one initially doesn't grasp. It seems that there are two phases to consider in these cases: a thinking or epistemic phase, in which the organism takes direct action to develop insight into the nature of the trouble and find a solution, and a type-A performance, in which the organism coordinates with and directly utilizes the structure of the situation
## 1.3: The New Problem in the Data
While I am still disentangling and formulating the central issues at play (and indeed determining the most appropriate terminology), at the moment there appear to be three main problems posed by intelligent achievements:

### 1.3.1 *The Problem of Insight*
To have insight is to *directly experience situational meaning*. To have insight into aspects of a situation's structure means to directly experience this structure. This comes in degrees. *The Problem of Insight* is this: how is insight possible, and how does it work?

### 1.3.2 The *Problem of Achievement*.


#### 1.3.2.1 The Problem of Productive Thinking / Inquiry
Organisms can take direct action to *develop* insight when it is lacking and needed. *The Problem of Inquiry* is this: how is inquiry possible, and how does it work? This problem has a direct continuity with *Meno's Paradox*--if you lack insight into the new problem situation, how is it possible to *seek* it?

### 1.3.3 *The Problem of Response*.
Organisms have some limited capacity to develop insight into and formulate an effective type-A response to novel situational demands. *The Problem of Achievement* is this: how is this possible, and how does this process work?

The Problem of Achievement involves two subproblems:

2a. Organisms can take direct action to *develop* insight when it is lacking and needed. *The Problem of Inquiry* is this: how is inquiry possible, and how does it work? This problem has a direct continuity with *Meno's Paradox*--if you lack insight into the new problem situation, how is it possible to *seek* it?

2b. When an organism *does* have insight *into* a situational demand, it can develop a direct (i.e. type-A) response to it, i.e. one that directly utilizes the relevant structure of these situational demands. *The Problem of Response* is this: given insight into a situation, how can an organism execute a type-A response?

---
# 2. The Gestalt Theory: Prägnanz in the Head
The Gestalt theorists began to develop a causal theory of insight. They did this by using the observed dynamic structure of insight to formulate hypotheses about its causal basis, and likewise to use characteristics of physical and physiological processes to formulate hypotheses about insight. In section 2.1, I describe the Gestalt strategy for developing a causal theory of insight and its rationale, drawing from the major works of Wertheimer, Köhler, and Koffka and secondary literature. In Part 2.2, I describe how this approach led to *the Two-World Problem* and *indirect realism*, and the defenses given thereof by the Gestalt theorists. I conclude in section 2.3 by evaluating the resulting picture in light of the problems posed at the end of chapter 1.
## 2.1 The Gestalt Strategy
The classical Gestalt approach to insight leveraged four crucial starting points: first, that experience and behaviour have the descriptive characteristics of insight (detailed in chapter 1); second, *The Psychophysical Isomorphism Hypothesis*, third, that there are physical systems with Gestalt characteristics (physical Gestalten), and fourth, *the neural locus claim*.

### [[2.1.1 The Psychophysical Isomorphism Hypothesis]]
I explicate *The Psychophysical Isomorphism Hypothesis*--the guiding hypothesis that the causal basis of experience and behaviour *shares its structure*. I explicate this idea as expressed by the Gestalt theorists, and illustrate some examples of causal hypotheses psychophysical isomorphism would allow one to generate on the basis of the characteristics of insight outlined in chapter 1.

### 2.1.2 Physical Gestalten
What kinds of physical systems would be candidates for having *the same structure* as the phenomenal and behavioural characteristics of insight and its development? In section 2.1.2, I will describe Köhler's identification and specification of physical systems with Gestalt characteristics (physical Gestalten). I will use his initial masterwork (1920) which identified *Prägnanz-like* laws of dynamic self-distribution in physical systems that attain a steady state, as well as his field-theoretic theory of *requiredness* offered in *The Place of Value in the World of Fact*s (1938).

### 2.1.3 The Neural Basis Claim
In section 2.1.3, I address *the neural locus claim*, that this psychophysical basis is localized in brain process.

### 2.1.4 Psychoneural Isomorphism
When the neural basis is conjoined with the psychophysical isomorphism hypothesis, you get the classical Gestalt theory of psycho-*neural* isomorphism. I will identify and reconstruct some arguments Koffka and Köhler gave for this view. At present it seems the most systematic of them is an abductive argument Koffka gives in his *Principles* (1935) which proceeds from a systematic exclusion of alternative answers to the question *Why do things look as they do?*

## 2.2 The Two-World Problem
With this conceptual groundwork in place, In section 2.2 I will outline the general causal theory of insight as it emerged in the original Gestalt theorists' work using theoretical concepts developed over the course of the previous section. I will consider in detail how the Gestalt theory addressed the problems posed in Chapter 1.3. Prior to carrying out this analysis, I think that I can argue that it initially looks like the theory makes some headway towards a solution to The Problem of Insight (section 2.2.1) and The Problem of Inquiry (section 2.2.2). When we get to the Problem of Achievement (section 2.2.3), though, it seems that the theory runs into a new difficulty, which threatens to undermine the progress previously made.

### 2.2.1
In section 2.2.4, I explore this difficulty. The psychoneural isomorphic theory led to a *duplication of worlds*--there is the public one consisting of the organism and its behaviour in its environment, and then *within the organism* there is a *phenomenal world*, which consists in an experienced ego, experienced behaviour, and an experienced environment. This two-world theory generates *Two-World Problems*--how does developing direct insight into a phenomenal world, for which a causal theory has now been proposed, result in the achievement of an adequate response to the new situational demand in the *real* world? The psychoneural dynamics may perhaps be a *part* of a causal theory that explains achievements of insight, but the organism's achievement of a type-A response adequate to new demands has not yet been given a theory.

While Köhler acknowledged something like this problem in 1926/1946, he posed it as an open problem. Koffka aimed to address this problem directly in his *Principles*, giving it the name *The Problem of Adjusted behaviour* (1935). In section 2.2.3, I will detail the answer Koffka gives to this challenge. The solution seems to be a kind of *elaborated reflex arc*, where the organism's *real* behaviour is *mediated by* phenomenal behaviour which occurs *in* the phenomenal world and develops along Prägnanz-like lines.
## 2.3 Evaluation: Insight Gained; Directness Lost
Finally, in section 2.3, I reflect on what has been gained and what has been lost by the classical Gestalt psychologists in the development of the causal theory of insight. I think I will conclude along these lines: On the one hand, we have gained a theoretical approach that has scope for the phenomenal and behavioural features of *insight* and its development. A causal basis was identified, if in a preliminary way. A guiding research strategy has been formulated. We even have gained a *phenomenal* kind of directness of insight which is not available in, e.g., information processing approaches. But on the other hand, we have lost *directness*. On the classical Gestalt theory, it is not clear that *the organism* can develop direct insight *into its life situation*. It can develop direct insight into its *phenomenal world* based according to the intrinsic dynamics of a brain field process, but the real situation of the organism in its environment either lacks psychological meaning as such, or has only such meaning as the organism's psychological field processes can reconstruct. This has helped us to identify a classificatory question for a theory of achievements of insight--does the theory enable the organism to directly develop insight into its life situation?
# 3. The Gibsons' Ecological Realist Adaptation: Breaking Meaning and Value Out of the Head

Today, the notions that an organism's environment *has* meaning and value and that it can be *directly* perceived is associated with one major psychological and philosophical research program--James and Eleanor Gibson's *ecological approach*, and theories which develop or incorporate it. The Gibsons kept from Classical Gestalt psychology the descriptive idea that the meaning and value of the environment is as immediately given in perception as its shape and colour, but rejected the classical Gestalt theorists' explanation in terms of a neural field process that reconstructed a phenomenal world. Instead, this meaningful environment was identified with the *real* surroundings of the organism redescribed *ecologically*, i.e. in terms of its meaning and value to the perceiving organism. To do this, the Gibsons had to undercut a core premise of Koffka's argument for the neural basis claim, namely that the meaningful structure we experience has to be built up out of proximal stimuli which lack this meaningful structure. This challenge was met with the invention of *ecological optics*, the concept of an *affordance*, and a reconceptualization of the perceptual process as one of *information pickup*.

Further, Gibson's roots in Gestalt psychology's theory of perception and Koffka's *Principles of Gestalt Psychology* are self-avowed (Gibson 1971) and widely acknowledged (e.g. Heft 2001, Kaufer & Chemero 2021). It is also well-known that Gibson's thesis that *organisms can directly perceive affordances of their environments* is an adaptation of the Gestalt idea that *we can directly perceive demand characters or physiognomic characters of the behavioural environment*. What is less well-known--but which the analysis in the preceding chapters should reveal--is that the latter is just a special case of the Gestalt idea that *organisms can have direct insight into the structure of their (phenomenal) situations*. Might we be able to develop a theory of *direct insight* by simply generalizing the ecological framework to insight in general, and then to use this to account for achievement and intelligent learning?

## 3.1 The Gibsons' Ecological Realist Adaptation of the Gestalt Framework
In this chapter, I will examine the ways in which James and Eleanor Gibson adapted core premises of the Gestalt framework with an emphasis on its implications for the Gestalt notion of insight and achievement. I will rely on major works (J. Gibson 1966, 1979; E. Gibson 1969; E. Gibson & Pick 2000; Reed & Jones 1982) and articles which contain direct discussions of the Gestalt framework or its theoretical concepts (e.g. Gibson 1941). Especially focal is James Gibson's retrospective critique of Koffka's *Principles of Gestalt Psychology* (1971), which second-generation Gestalt theorist Mary Henle praised as "the best review, I believe, that this important work has had" (1987, p.15).

### "Same line of theoretical development"
### 3.1.1 Common Ground
In section 3.1.1, I will describe several core premises that James and Eleanor Gibson took as common ground with or points of departure from the Gestalt theorists.
#### 3.1.1.1 The "Phenomenological Attitude"

#### 3.1.1.2 Descriptive Account: Things *Look* their Meaning and Value

### 3.1.2 The Realist Rebellion
their critiques of the classical Gestalt theory, and the nature of their ecological realist reworking of the Gestalt framework. After outlining the shape of the ecological framework (3.1.1), in 3.1.2 I will address at least the following important issues:
- What issues did the Gibsons take with the indirect realism of the Gestalt framework?
- How did the affordance concept adapt the Gestalt notion of a demand character?
- How did Gibson reconceptualize the perceptual process from one cast primarily in terms of intrapsychic forces of organization into one in terms of an organism's direct interactions with its environment?
- How did Gibson's formulation of *ecological optics* undercut arguments for reconstructive perception that rely on the distinction between the proximal stimulus and distal stimulus?
- Gibson used his ecological framework to answer Koffka's grand question *Why do things look as they do?* with *"because attention is paid to certain features of the array and not others"*(1979). What are the implications of this answer for insight, inquiry, and intelligent achievement?
## 3.2 Can the Gibsons' Ecological Realism Handle Insight?

### 3.2.1 What the Gibsons said about Insight
In section 3.2, I will collect and discuss the scattered direct remarks that James and Eleanor Gibson made about the Gestalt notion of insight, thinking and problem solving, and achievement. This includes

#### 3.2.1.1
James Gibson's proposal that acquiring insight is *noticing previously unnoticed affordances* (1966);

#### 3.2.1.2
Eleanor's suggestion that acquiring insight is *detecting higher order structure* (1969), and

#### 3.2.1.3
Eleanor and Pick's final proposal that acquiring insight is perceiving higher-order affordances of a *means-end* character (2000).

### 3.2.2 Why the Gibsons' Proposals Don't Work
In section 3.2.2, I show that these strategies are insufficient for reasons already argued for by the Gestalt theorists on conceptual and experimental grounds.

#### 3.2.2.1 Issue 1: Holistic Determination of Affordances
The first proposal that the ape notices the rake character of the stick does not work because it is insufficient to see a *piece* of a possible solution in isolation (e.g. $|r|$). It needs to be seen as a part of a whole solution (e.g. $\\Bigg|{r\\phantom{bae} \\atop rbae}$).
#### 3.2.2.2 Issue 2: "*Detecting Higher Order Structure*"  and "Noticing Higher-Order Affordances"
The latter two proposals fall into what Koffka calls *The Problem of Innumerable Relations* (1925a): if acquiring insight lies in noticing or detecting relations, how does the problem solver come to see *just the relations constituting a solution* among the innumerable relations present in the situation?
Kohler's critique of William James in his 1929 is relevant here.


## 3.3 Can Contemporary Ecological Psychology Handle Insight?
In this section, I consider recent attempts in the contemporary literature which aim either to treat insight, problem solving, or type-A behaviour.

### 3.3.1 Situated Normativity and the Skilled Intentionality Framework
In section 3.3.1, I consider several proposals for refinements of the ecological framework which aim to reincorporate descriptive characteristics of insight which were disavowed by James and Eleanor Gibson, such as *demand* or *invitation* characters (Withagen 2022, 2023, 2024; Reitveld 2008; Van Den Herik & Reitveld 2017, 2021; Starzak & Schlicht 2023).

### 3.3.2 Ecological Approaches to Problem Solving and Insight
Of problem solving, I consider a number of recent works which either apply concepts and methods from the ecological literature to problem solving (e.g. Baggs & Steffensen 2022), or which make steps towards developing an ecological *theory* of problem solving (e.g. Steffensen & Valee-Tourangeau 2016, 2018).

### 3.3.3 Ecological Approaches
Finally, of type-A behaviour, I will consider Bernstein-inspired ecological theories of behaviour that, like the Gestalt theory, use self-organizational principles to explain tendencies for an organism to converge on relatively efficient and effective behaviour (e.g. Reed 1982, 1996; Jacobs & Michaels 2007; Latash 2008, 2021; Baggs, Raja & Anderson 2020). I will compare these approaches with Köhler's physical Gestalten, and consider the degree to which they can explain the properties of type-A behaviour.

Tentatively and on the basis of work already done, I can say that I will likely conclude that while the ecological approach has developed promising theoretical resources and experimental strategies for relocating meaning and value in the organism-environment system, there are obstacles to deploying them to handle critical phenomenal and behavioural aspects of insight and achievement.
1. The ecological approach has difficulty addressing *the problem of insight* because it has difficulty conceptualizing many aspects of *requiredness* as real, intrinsic features of the organism-environment situation that can be directly experienced;
2. this gives rise to a critical difficulty addressing *the problem of inquiry* because it has difficulty conceptualizing the directly experienceable *problem character* of novel problem situations ($S_{1}$). Without such an account, the ecological realist cannot use the Gestalt strategy of rendering experienced problematic structural characteristics into *causally efficacious features of* $S_{1}$ that can guide and drive the transition to $S_{2}$. How, then, can the organism come to perceive just the right solutions for the first time?
3. It has some promising resources for explaining characteristics of Type-A responses (e.g. affordances, ecological optics, synergies), but it has difficulty addressing *The Problem of Achievement* because its theoretical resources for dealing with behaviour are broadly *task-dependent*.
## 3.4 Evaluation: Directness Gained, Insight Lost
I will conclude with an assessment of the ecological approach, first with the positive ground gained towards a theory of intelligent achievement, and second of the difficulties the approach faces in accounting for the descriptive facts of insight. While the Gibsons' approach succeeds in avoiding indirect realism by circumventing the Two-World Problem, in its process of formulation it overlooked or even denied some of the descriptive facets of insight, and excised critical explanatory resources of the Gestalt approach central to its theory of insight and of achievement. The prospect of modifying the Gibsonian framework or its post-Gibsonian developments to address the Problem of Insight and the Problem of Achievement will need to address the basic descriptive facts of insight and achievement; and to develop an explanatory account of how requiredness can be a real part of the structure of a situation; of how an organism can develop direct insight into its real situation when it is lacking and needed; and of how the organism can achieve a type-A response to needful situations in which no pre-determined task is given for the first time.

# 4. Extended Insight

The Gestalt approach can account for some aspects of achievements of insight, at the cost of losing direct contact with the real situation. The Ecological Realist framework allows for direct contact with the real situation, but can no longer account for insight. Can we have it both ways? In this chapter will argue that the Gestalt approach can be reformulated in a way that avoids the Two-World Problem and indirect realism, while retaining *almost all* of their productive theoretical and experimental resources for investigating insight, thinking, and type-A behaviour. It involves rejecting only one of the premises of classical Gestalt approach--the neural basis claim. In its place, we can adopt something like *the extended mind thesis*. If this can be achieved, then the Gestalt theoretical strategy for investigating insight, problem solving, and achievement can be reformulated to apply to studying psychological processes at the organism-environment scale.

To this effect, I will take this strategy:
## 4.1 Extended Insight Phenomena?
In 4.1, I will describe some descriptive phenomena which appear to be evidence for *extended insight*: insight and achievements which seem to occur in processes spanning the whole life situation of the organism, rather than processes strictly inside its head.

### 4.1.1 In the Gestalt Theorists Themselves

### 4.1.2 Kurt Goldstein's Organismic Interpretation
some of Kurt Goldstein's clinical and experimental work on the nature of recoveries from brain injury (Goldstein 1939/1995, 1942)

### 4.1.3 Unified Behaviour in Split Brain Patients
Including some reports of phenomena in the split brain literature which, I argue, appear to be extracortical processes of cognitive integration in split brain patients (e.g. Gazzaniga 2013, Kingstone & Gazzaniga 1995; many cases are described in Schechter 2014).

### 4.1.4 "Outsight"
I will describe some reports in the early Gestalt theorists themselves (e.g. Koffka's 1935 discussion of spontaneous adaptive reorganization), some of Kurt Goldstein's clinical and experimental work on the nature of recoveries from brain injury (Goldstein 1939/1995, 1942), and more recently

### 4.2 Extending Isomorphism
Next, in section 4.2, I pose the problem of how we might adapt the classical Gestalt strategy by replacing the neural basis claim with something like an *extended mind thesis*. This would make it possible to formulate an *extended* Gestalt strategy--an approach which joins the descriptive facts of insight; The Psychoneural Isomorphism Hypothesis; and the theory of Physical Gestalten with the hypothesis that the psychophysical process spans the organism-environment system. The question is: how? There are many flavours of extended mind accounts, including conservative ones relying on representational mechanisms. I will introduce John Dewey's *transactive* approach, and use Wertheimer's characterization of the Gestalt strategy and Köhler's theory of physical Gestalten to argue that Dewey's approach is *what it would look like* to treat the organism-environment system as a physical gestalt system.

## 4.3 Transactive Isomorphism
John Dewey, Kurt Goldstein (1939/1995, 1940, 1942), Abraham Maslow (1954, 1962, 1971), and even at times the original Gestalt theorists themselves, took some steps in this direction. In section 4.3, I will draw on insights from these thinkers to develop a theory of insight, inquiry, and achievement as extended Gestalt processes at the organism-environment scale. An earlier sketch of this framework-in-progress is described in Bowen (2022).

## 4.4 Using Transactive Isomorphism to Investigate Insight
In section 4.4, I will evaluate this transactive-isomorphic view by seeing how it handles the phenomena and problems considered in chapter 1, as well as the additional ones introduced along the way. I will then give a general statement of how you can *use* the transactive-isomorphic approach to generate hypotheses, and illustrate its use by exploring suggested hypotheses to the original insight data.

## 4.5 Objections and Difficulties for Transactive Isomorphism
Section 4.5, I will identify some difficulties unique to an extended isomorphistic approach, and aim to defend it against these difficulties. I anticipate at least the following.

First, like the Classical Gestalt theory (Köhler 1929b/1971, Levy 1967), this view has to contend with paradoxes of location and reference. For the Classical Gestalt theory, the paradox was that the experienced environment is *inside* the organism, not outside it. For an extended isomorphic theory, the locus and reference of one’s psychophysical basis and its experienced reference substantially *overlap.* Why, then, is there not, e.g., one merged experience, as opposed to plural points of view?

Second, there may be a concern that this theory implies that the world has contradictory properties. Two neighbours can inhabit the same apartment, yet when one walks out the door, they encounter a ruthless, hostile jungle that demands vigilance and defense, while the other is met with a friendly world full of opportunities that invites exploration and enjoyment (Maslow 1943). On an extended isomorphistic view, one and the same neighbourhood somehow is the locus of these real, contradictory properties. Does this run afoul of the law of non-contradiction?

## 4.6
Finally, in section 4.6 I will address possible objections from classical Gestalt, ecological, and Deweyan camps. From the Gestalt camp: Does the transactive-Gestalt theory really do justice to the observational facts *and* avoid naive realism? Second, James Gibson eliminated demand characters from the affordance concept and determination by changing needs of the organism because he was very concerned with avoiding a kind of problematic subjectivity that he, with the Gestalt theorists, took to have epistemological consequences (e.g. the *Two-World Problem* and indirect realism). Is the present account any less "realistic," and does it truly escape the epistemological consequences of the classical Gestalt approach? Finally, I will consider whether there might be objections from Dewey scholarship. Only one direct argument for incompatibility with the Gestalt tradition at large has been located (Gowin 1959). Besides this, Johnson & Schulkin (2023) have recently attempted to integrate Dewey's philosophy with contemporary cognitive science. I will compare their approach with the present one in light of the Gestalt problems.

# 5. A Working Framework and Applications
If the extended isomorphism hypothesis is correct, and if organisms can directly respond to arbitrary inadequacies of their life situation by developing insight into them through inquiry, what follows?

If a conceptual framework and approach can be developed, it could be applied not only widely throughout cognitive science, but also philosophy. The only question is where to start. This will hopefully become more clear when I come to this point. I will conclude with a preliminary sketch of some ways in which this transactive-Gestalt approach could be applied. I will briefly pose some possible directions and open problems to tackle with this approach, including at least human creativity, comparative psychology, philosophy of mind, education, and artificial intelligence.

I will also trace an outline of several specific directions I hope to apply this approach to. I can name a number of them that are in progress already, and which I have been hoping to understand with the help of a theoretical framework like this. The first has to do with explaining the *extended insight* phenomena in the split-brain cases earlier. I have been trying to sort them out with Mike and Elizabeth since at least 2018. This conceptual approach is in large part *where I had to go* in order to make sense of what might possibly explain these phenomena. The second is to use this theory to find ways of operationalizing and adapting Maslow's motivational theory to non-human animals in ongoing collaboration with a comparative psychology colleague. Another is more along the lines of social and political psychology--I have been working with Manpreet on a Dewey-inspired framework for understanding processes of social orientation and naturalization in the case of immigrant identity. Finally, I have been working on global environmental sciences as functional systems with Gillian for a while. The physical Gestalten concept can be applied there, too. It would be interesting to see how an extended-isomorphistic version of the Gaia hypothesis would play out.


`;
