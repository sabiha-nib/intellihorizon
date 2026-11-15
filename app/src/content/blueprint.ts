// Concept book content for judges and partners. English only by design (competition language).

export type Feature = { cat: string; name: string; exp: string; diff: string; value: string; evidence: string; tier: 1 | 2 | 3 | 4; live: boolean };

export const CATEGORIES: { id: string; name: string }[] = [
  { id: "A", name: "The living home universe" },
  { id: "B", name: "Discovery-based learning" },
  { id: "C", name: "Adaptive AI teaching" },
  { id: "D", name: "Knowledge visualisation" },
  { id: "E", name: "Subject-specific worlds" },
  { id: "F", name: "Multimodal learning" },
  { id: "G", name: "Intellectual progression" },
  { id: "H", name: "Examination and curriculum" },
  { id: "I", name: "Creation and experimentation" },
  { id: "J", name: "Memory and long-term understanding" },
  { id: "K", name: "Multilingual and accessible learning" },
  { id: "L", name: "Real-world missions" },
  { id: "M", name: "Collaboration and community" },
  { id: "N", name: "Student agency and trust" },
  { id: "O", name: "Surprising new categories" },
];

const f = (cat: string, name: string, exp: string, diff: string, value: string, evidence: string, tier: 1 | 2 | 3 | 4, live = false): Feature => ({ cat, name, exp, diff, value, evidence, tier, live });

export const FEATURES: Feature[] = [
  f("A", "The Understanding Sky", "Home is a night sky of subject constellations. Each concept is a star whose brightness shows evidenced understanding; tapping a star shows its chapter, evidence and bridges.", "Progress is a map of what you can do, not a grid of percentages, streaks or XP.", "Students see at a glance what is solid, fragile or unexplored without a dashboard.", "Students can correctly say which of their concepts are fragile versus solid when asked.", 1, true),
  f("A", "One Useful Next Step", "Beside the sky, one card names the single most useful action and why: repair a misconception, test a fragile idea, or start something new.", "A reasoned recommendation with its reason shown, instead of a feed of widgets.", "Removes decision paralysis for short study windows on a shared phone.", "Share of sessions that start within 10 seconds; completion of recommended steps.", 2, true),
  f("A", "Light That Never Punishes Breaks", "Stars never dim because a student missed days. Only a failed revisit can show that an idea needs another look.", "Rejects streak loss and login guilt entirely.", "Protects motivation for learners with irregular access to devices or data.", "Return rate after gaps of 7+ days compared with streak-based products.", 2, true),
  f("A", "Three-Tap First Wonder", "A first-time student picks a language, a class, then a curious question, and is learning in under a minute with no diagnostic test.", "Personalisation is earned through activity, not demanded up front.", "Lowers friction for first-time and low-confidence users.", "Time from first open to first meaningful answer; drop-off during onboarding.", 2, true),
  f("A", "Subject World Doors", "Each subject opens into its own world page with chapters listed by their real NCTB names beside the constellation.", "Exploration never hides the official chapter a student must study.", "Keeps curriculum navigation fast for exam-focused students.", "Time to locate a named chapter in usability tests.", 2, true),

  f("B", "Predict Before You're Told", "Every lesson starts by asking for a prediction and a confidence level. The answer is locked in but not judged until the student has tested it.", "Wrong predictions become discoveries rather than failures.", "Surfaces prior ideas that direct teaching would overwrite silently.", "Pre and post gains on concept inventories versus explanation-first lessons.", 1, true),
  f("B", "Drop Lab", "Two objects fall side by side. Students switch the air off, go to the Moon, slow time and watch live speed-time lines.", "The student controls the variable that resolves their own prediction.", "Targets the most persistent misconception in school mechanics.", "Reduction in 'heavier falls faster' answers on delayed transfer items.", 1, true),
  f("B", "The Roti Table", "Students cut two identical rotis into any number of pieces, take some, line the shares up as bars, then re-cut both into same-size pieces.", "Common denominators appear as a physical act before they appear as a rule.", "Repairs denominator and numerator-only misconceptions with a local, familiar object.", "Accuracy on unfamiliar fraction comparisons two weeks later.", 1, true),
  f("B", "Evidence Board", "Students weigh six real pieces of evidence against their own answer to where a tree's mass comes from, compare their reading with IntelliHorizon's, then decide whether to revise.", "The learner judges evidence; the app explains disagreement instead of marking it.", "Builds evidence-based reasoning, not only the photosynthesis fact.", "Rate of justified revisions and quality of written justifications.", 1, true),
  f("B", "Reconstruct the Rule", "Students are given worked examples without the rule and must state the pattern, then test it on a case designed to break a sloppy version.", "Rules are discovered and stress-tested, not handed over.", "Develops inductive reasoning and checks over-generalisation.", "Proportion of student-stated rules that survive the breaking case.", 3),
  f("B", "Curiosity Credit", "When a student asks a question that leads to a new bridge or experiment, the question itself is saved to their sky as a small comet.", "Rewards good questions, not just right answers.", "Encourages question-asking in students who stay silent in class.", "Number and quality of student questions over a term.", 3),
];

FEATURES.push(
  f("C", "Confidence as Evidence", "Every answer carries a three-bead confidence choice: guessing, fairly sure, certain.", "Correct guesses and confident errors are treated differently, which most quiz apps cannot see.", "Separates lucky answers from understanding and flags deep misconceptions.", "Calibration gap shrinking over time; fewer confident errors.", 1, true),
  f("C", "Misconception Mirror", "Wrong options are mapped to named, teacher-authored misconceptions. The student sees the name, what it looks like, and that it is only a guess.", "Diagnosis is visible and specific instead of a silent score change.", "Lets repair target the actual idea, not just the wrong answer.", "Recurrence rate of each named misconception after repair.", 1, true),
  f("C", "Four-Way Repair", "Each misconception can be explained four ways: show me, a story, step by step, or a comparison. The student switches freely; the choice becomes the next default.", "Adapts to demonstrated preference without labelling a learner type.", "A second explanation often succeeds where the first failed.", "Success on the next item after each style; style switches per repair.", 1, true),
  f("C", "That's Not What I Was Thinking", "Under every diagnosis, one tap lets the student say they misread, mis-tapped or had another reason. The model stops counting that misconception.", "The learner can overrule the AI's interpretation.", "Prevents wrong labels from compounding and builds trust.", "Challenge rate per misconception (high rates flag a badly written item).", 1, true),
  f("C", "Explained Adaptation", "Whenever practice is personalised, a short note says why: which misconception it targets and which questions are retries.", "Personalisation is never a black box.", "Students learn to direct their own revision.", "Students' ability to explain why they received an item, in interviews.", 2, true),
  f("C", "Prerequisite Detour", "When errors trace to a missing earlier idea, the sky highlights that prerequisite star and offers a two-minute detour before returning.", "Repairs root causes instead of drilling the surface topic.", "Addresses the common case of failing because of a gap from earlier grades.", "Success on the original topic after the detour versus without.", 3),
  f("C", "Socratic Hint Ladder", "Instead of revealing an answer, help arrives as up to three questions of increasing specificity before any worked step.", "The most valuable AI move is often a question.", "Preserves productive struggle and independent thinking.", "Proportion of problems solved after hint one versus full solution views.", 2),

  f("D", "Bridges", "Selecting a star draws stitched threads to related ideas in other subjects, each with one sentence explaining the connection.", "A few meaningful revelations instead of an unreadable knowledge graph.", "Shows that ideas transfer across subjects.", "Use of bridges and performance on cross-subject transfer items.", 1, true),
  f("D", "Then and Now", "At the end of a lesson the student's own first prediction sits beside their current star, ideas taught and misconceptions let go.", "Progress is shown as a change in thinking, not a number.", "Makes learning visible to the learner and rewards revision.", "Student self-reports and accuracy of their own description of change.", 1, true),
  f("D", "Fragility Glow", "Correct but unsteady ideas flicker softly on the sky until tested in a new form.", "Distinguishes 'got it right' from 'understands it'.", "Prevents false confidence before exams.", "Correlation between fragile flags and later errors.", 2, true),
  f("D", "Confusion Pinpoint", "While reading an explanation, the student taps the exact sentence where it stopped making sense; the next explanation starts from there.", "Locates confusion precisely instead of restarting.", "Saves time and reveals weak explanations for authors.", "Reduction in repeated full re-explanations; author fixes per pinpoint cluster.", 3),
  f("D", "Idea Lineage", "Any concept can be opened as a short vertical path of the ideas it builds on, ending at something the student already lit.", "Prerequisites anchored to the learner's own lit stars.", "Helps students plan self-study of foundations.", "Frequency of self-initiated prerequisite study.", 3),

  f("E", "Physics: Predict and Run", "Every physics star opens a small simulation where the student changes one variable at a time after predicting.", "Experiments resolve the student's own claims.", "Builds causal reasoning, not formula recall.", "Control-of-variables skill on new investigations.", 2, true),
  f("E", "Mathematics: Why It Works", "Procedures appear only after a visual or physical reason, and each rule is tested on a case designed to break a sloppy version.", "Understanding precedes procedure.", "Reduces rote rule misuse.", "Errors from misapplied procedures on novel problems.", 2, true),
  f("E", "Biology: Evidence First", "Biology stars present real data and historical experiments that the student weighs before the textbook statement appears.", "Biology as reasoning from evidence, not a list of facts.", "Develops scientific argument.", "Quality of evidence use in written answers.", 2, true),
  f("E", "Chemistry: Two Zooms", "Every visible change (ice melting, a candle in a sealed jar) is paired with a particle-level view the student can zoom into.", "Connects observation with the particle model at every step.", "Targets the gap between macroscopic and particulate thinking.", "Particle-diagram accuracy on unseen phenomena.", 3),
  f("E", "English: Three Audiences", "Students rewrite one message for a headteacher, a friend and a city council and see each simulated reader's reaction.", "Writing judged by its effect on a reader.", "Builds audience awareness and argument.", "Rubric gains on audience and register.", 3),
  f("E", "Bangla: Defend Your Reading", "Students interpret a line of poetry and must anchor the interpretation in words from the text.", "Interpretation is welcomed but must be evidenced.", "Builds literary analysis without one fixed answer.", "Teacher-rated quality of textual evidence.", 3),
  f("E", "ICT: Debug the Robot", "A robot follows the student's algorithm across a river crossing; the student finds where the instructions fail.", "Computational thinking through debugging, not syntax.", "Teaches decomposition and testing.", "Debugging success on new faulty algorithms.", 3),
  f("E", "History: Two Sources", "Students compare two accounts of the same day and decide what can be trusted and why.", "Source evaluation instead of memorised dates.", "Builds critical reading of claims.", "Quality of reliability judgements.", 3),
  f("E", "Geography: Delta Builder", "Students watch silt build land and decide where a village should grow, given flood and river data.", "Spatial reasoning with consequences.", "Connects geography to local decisions.", "Reasoned use of data in decisions.", 4),
);

FEATURES.push(
  f("F", "Teach Rumi", "Students explain an idea in their own words, typed or spoken, to a simulated Class 5 learner who asks follow-ups until each key idea has been covered.", "The student teaches; the AI plays the learner.", "Explaining exposes gaps that answering multiple choice hides.", "Explanation completeness scores before and after; transfer gains.", 1, true),
  f("F", "Speak in Bangla, Hear the Term", "A student can ask or explain aloud in Bangla; key scientific terms are echoed in both languages.", "Voice is judged for ideas, never accent.", "Supports students who think in Bangla but sit exams with English terms.", "Use of correct bilingual terminology in later written answers.", 2, true),
  f("F", "Read Aloud", "Any question or explanation can be read aloud with the device voice, in Bangla where available.", "Works offline with the phone's own voice.", "Supports weaker readers and students with visual difficulty.", "Usage by students flagged as struggling readers; comprehension gains.", 2, true),
  f("F", "Snap My Working", "A student photographs handwritten working; the step where reasoning diverged is highlighted, with a prompt to correct the interpretation if handwriting was misread.", "Feedback on a specific step, with the student able to fix misreadings.", "Most exam work is handwritten.", "Accuracy of step localisation in teacher audits.", 3),
  f("F", "Draw Then Compare", "Students sketch a diagram (a circuit, a cell) and compare it with a checked representation, labelling the differences themselves.", "Students find the differences instead of being told.", "Builds diagram literacy.", "Diagram accuracy on later unprompted drawings.", 3),
  f("F", "When Text Fails, Show Me", "If a student misses after a text explanation, the next attempt automatically offers a diagram or simulation first.", "Representation changes because of evidence, not a learning-style label.", "Gives a second route into hard ideas.", "Success rate after modality switch.", 2),

  f("G", "Shapeshifter Trials", "An idea is tested in four disguises: a new situation, a new form, the other language and arguing it back. Each survival adds light.", "Mastery means transfer, not repetition of the same question.", "Distinguishes memorised answers from understanding.", "Correlation of disguise survival with delayed, unfamiliar test items.", 1, true),
  f("G", "Six Kinds of Light", "Stars move through glimpsed, fragile, holding, survives disguises and durable, each defined by observable evidence.", "Bloom-like depth without six boring tabs.", "Students understand what deeper understanding looks like.", "Students' ability to describe what moves a star up.", 1, true),
  f("G", "Changed Mind With Evidence", "When a student revises a wrong belief after weighing evidence, it is recognised explicitly in Then and Now.", "Rewards intellectual courage, not just correctness.", "Normalises revising ideas.", "Frequency of justified revisions over a term.", 2, true),
  f("G", "Capability Unlocks", "Lighting a star unlocks a new way to interact with it, such as designing your own Drop Lab challenge.", "Mastery changes what you can do, not what you wear.", "Moves students up from applying to creating.", "Quality of student-designed challenges.", 3),
  f("G", "Durable Light", "A star becomes durable only after it survives a revisit at least a day later.", "Retention is part of mastery.", "Builds long-term memory, not cramming.", "Delayed retention at 1, 7 and 30 days.", 2, true),

  f("H", "Tomorrow Mode", "A student with an exam tomorrow chooses a chapter and time; IntelliHorizon assembles exam-style practice targeted at their recorded misconceptions and explains why.", "Fast, focused and honest exam preparation inside a universe product.", "Serves the student's immediate need without theatrics.", "Performance on curriculum questions after Tomorrow Mode versus self-study.", 1, true),
  f("H", "Readiness With Uncertainty", "After practice, a readiness band appears with the number of answers it is based on and a plain warning that it is not a mark prediction.", "Refuses false precision.", "Avoids anxiety and overconfidence from fake scores.", "Calibration between readiness bands and later school results.", 2, true),
  f("H", "Calibration Check", "The summary shows how often the student was certain and right, and which right answers were guesses.", "Metacognition becomes an exam skill.", "Guides what to revise when time is short.", "Improvement in calibration across sessions.", 2, true),
  f("H", "Chapter Truth Line", "Every activity carries its NCTB subject, grade and chapter label.", "Exploration never obscures the syllabus.", "Builds teacher and parent trust.", "Teacher agreement with mappings in audits.", 2, true),
  f("H", "Board Question Twins", "For each past exam pattern, a twin question in a new context checks that a student can do the type, not the memorised item.", "Exam practice that resists rote memorisation.", "Prepares for unseen exam variants.", "Performance on unseen board-style items.", 3),
  f("H", "Ten-Minute Revision Card", "A one-screen card lists the two or three ideas most worth revising before tonight, each linked to its repair.", "Prioritised by evidence, not by chapter order.", "Maximises short revision windows.", "Use rate and next-day accuracy on listed ideas.", 2, true),
);

FEATURES.push(
  f("I", "Design Your Own Disguise", "After a star is lit, students write a new disguise question for a classmate, choosing which misconception their wrong options should catch.", "Students create assessment, which requires deep understanding.", "Reaches the creating level of Bloom's taxonomy.", "Teacher-rated validity of student-written items.", 3),
  f("I", "Build-a-Lab", "Students assemble their own experiment from parts (objects, environments, measurements) to answer a question they choose.", "Experiment design, not experiment following.", "Teaches control of variables and fair tests.", "Fair-test quality on new investigations.", 3),
  f("I", "Model It, Then Break It", "Students build a simple model (a food web, a circuit) and then try inputs that should break it, explaining why it did or did not.", "Models are tested against evidence.", "Teaches the limits of models.", "Accuracy of predictions about model failure.", 4),
  f("I", "Explain to Three Listeners", "The student records one explanation and hears it judged by a younger student, a classmate and a sceptical scientist.", "Same idea, three standards of explanation.", "Builds flexible communication.", "Rubric gains for clarity and rigour.", 3),
  f("I", "Poster from Proof", "A lit concept can be turned into a one-page poster the student composes from their own Rumi explanation and lab results.", "Artifacts come from the learner's own evidence.", "Gives a shareable product of learning.", "Teacher-rated accuracy of posters.", 4),

  f("J", "Next-Day Echo", "A day after a star lights up, the next useful step becomes one quick disguise to check it is still there.", "Spaced retrieval tied to understanding, not flashcards.", "Turns short-term success into durable memory.", "Delayed retention versus no echo.", 2, true),
  f("J", "Forgetting Without Shame", "When a revisit fails, the star returns to fragile with a note: forgetting is normal, here is the fastest way back.", "No punishment, just a path.", "Keeps struggling students engaged.", "Re-attempt rate after a failed revisit.", 2),
  f("J", "Interleaved Night", "Practice sessions mix two or three lit ideas from different subjects in one sitting.", "Interleaving across worlds, not only within a chapter.", "Strengthens discrimination between similar ideas.", "Performance on mixed-topic tests.", 3),
  f("J", "Memory Weather", "A gentle forecast on the sky shows which stars may be fading based on time since last evidence, never on a fixed schedule alone.", "Retention signals shown as an estimate.", "Helps students plan revision.", "Accuracy of fading forecasts versus revisit results.", 4),
  f("J", "Sleep-on-It Prompt", "After a difficult lesson, the app suggests stopping and returning tomorrow rather than continuing late.", "An app that tells you to stop.", "Protects wellbeing and supports consolidation.", "Late-night session length; next-day accuracy.", 3),

  f("K", "Switch Language Mid-Question", "A Bangla and English toggle works everywhere, even halfway through a question, without losing progress.", "Bilingual by design, not translated afterwards.", "Supports Bangla and English medium learners and code-switchers.", "Use patterns and accuracy by language.", 1, true),
  f("K", "Language Disguise", "One trial for every concept appears in the other language, with a one-tap reveal in the student's own language.", "Language transfer is treated as part of understanding.", "Prepares Bangla-medium students for English terminology and vice versa.", "Accuracy on the disguise with and without reveal.", 1, true),
  f("K", "Offline Study, Clear Sync", "Visited lessons keep working without signal; evidence is queued on the phone and the status shows what is waiting to sync.", "Honest about what works offline.", "Serves students with expensive or unreliable data.", "Offline session share and sync success rate.", 2, true),
  f("K", "Light Mode for Light Phones", "Every interaction is plain SVG and text: no 3D requirement, no video streaming, reduced motion respected.", "Spectacle never gates learning.", "Runs on low-cost Android devices.", "Load time and battery use on entry-level phones.", 2, true),
  f("K", "Bilingual Term Bridge", "Key terms show both scripts with a short local example, such as acceleration and ত্বরণ.", "Terminology support built into content.", "Reduces errors from terminology confusion.", "Bilingual term accuracy in written answers.", 3),
  f("K", "Adjustable Without Labels", "Text size, contrast, motion and audio are set by the student without any disability or ability label being stored.", "Accessibility without categorising children.", "Inclusive for students with different needs.", "Usage of settings and completion parity across groups.", 3),

  f("L", "Monsoon Mission", "Students use supplied rainfall data, clearly labelled as real or simulated, to plan a planting calendar for a village plot.", "Real data, local problem, honest labels.", "Applies maths and science to livelihoods.", "Quality of data-based justifications.", 3),
  f("L", "Solar Roof Engineer", "Students compare solar panel options for a rural home using energy and cost calculations.", "Engineering trade-offs, not single answers.", "Connects energy lessons to real decisions.", "Correctness and reasoning in design choices.", 3),
  f("L", "Arsenic-Safe Water Detective", "Students interpret a simulated tube-well testing map to decide which wells to mark and why, with health-literacy framing.", "Age-appropriate public-interest science.", "Builds data literacy on a real national issue.", "Accuracy of evidence-based decisions.", 4),
  f("L", "Career Echoes", "Each lit star shows two or three professions in Bangladesh where the idea is used daily, from a pilot to a rice researcher.", "Shows why ideas matter beyond the exam.", "Raises aspiration and relevance.", "Change in students' stated career awareness.", 3),
  f("L", "Market Maths", "Students run a small stall simulation using fractions, percentages and profit.", "Financial literacy through play.", "Practical numeracy.", "Transfer to percentage problems.", 3),
);

FEATURES.push(
  f("M", "Class Constellation", "A teacher sees the whole class as one sky: which ideas are fragile for many students, with no individual names shown unless students opted in.", "Insight without surveillance or public ranking.", "Helps teachers decide what to reteach tomorrow.", "Teacher-reported usefulness; reteach decisions made.", 2),
  f("M", "Two Valid Paths", "In group challenges, different correct approaches are shown side by side with no votes or likes.", "Compares reasoning, not popularity.", "Teaches that problems have multiple routes.", "Students' ability to explain another's method.", 3),
  f("M", "Kind Critique Cards", "Students review a peer's anonymous explanation using three sentence starters: one strength, one question, one suggestion.", "Structured, moderated, anonymous feedback.", "Builds constructive criticism safely.", "Quality of critiques and revisions made after them.", 3),
  f("M", "Sister School Missions", "Classes in two countries solve the same local problem in their own context and exchange teacher-moderated summaries, never open chat.", "International collaboration without minors' public profiles.", "Global perspective with safety.", "Participation and quality of comparative reflections.", 4),
  f("M", "Family Note", "If a student switches it on, families receive a short plain-language note about what was explored, with no marks or rankings.", "Respectful family insight by the student's choice.", "Builds home support without pressure.", "Family-reported understanding; student comfort.", 3),

  f("N", "The Mirror", "One page shows everything IntelliHorizon believes about the student, the evidence for each belief, and controls to correct it.", "The learner model is inspectable and contestable.", "Builds trust and metacognition.", "Visits to the Mirror; corrections made; trust survey scores.", 1, true),
  f("N", "Source Labels", "Every piece of content is labelled as a checked curriculum fact, a historical record or an IntelliHorizon explanation that may contain mistakes.", "Students always know what kind of claim they are reading.", "Teaches information literacy and limits over-reliance.", "Students' ability to identify claim types.", 2, true),
  f("N", "Off by Default Sharing", "Teacher and family sharing are switched off until the student turns them on, with a plain list of what would be shared.", "Privacy is the default for minors.", "Respects student agency.", "Opt-in rates and comprehension of what is shared.", 2, true),
  f("N", "Delete Everything", "One clearly confirmed action removes the student's sky and all evidence permanently.", "Real deletion, not deactivation.", "Respects data rights on shared devices.", "Successful deletions; support requests.", 2, true),
  f("N", "No Personal Data Needed", "Students learn without giving a name, phone number or email. Free text written to Rumi never leaves the device.", "Data minimisation built into the product.", "Lowers privacy risk for children.", "Audit of stored fields.", 2, true),

  f("O", "Proof of Understanding Passport", "Long-term: a student can export which ideas survived which disguises as a verifiable, private record they choose to share.", "Credentials based on transfer, not seat time.", "Recognises learning outside formal schooling.", "Acceptance by teachers and programmes.", 4),
  f("O", "Misconception Weather Map", "Anonymous, aggregated misconception patterns across districts help curriculum authors see where an explanation is failing.", "Turns learners' mistakes into curriculum improvement.", "System-level impact beyond one student.", "Changes made to materials and their effect.", 4),
  f("O", "Argue With a Historical Scientist", "Students debate a simulated Galileo, Van Helmont or Jagadish Chandra Bose who holds the beliefs of their time, using evidence to change their mind.", "History of science as a live argument, clearly labelled as simulation.", "Shows that knowledge changes with evidence.", "Quality of evidence-based arguments.", 4),
  f("O", "Wrong on Purpose", "IntelliHorizon deliberately makes a subtle mistake in a worked solution and the student earns light by catching it.", "Trains healthy scepticism of AI answers.", "Builds checking habits and reduces blind trust.", "Detection rate of planted errors.", 3),
  f("O", "The Quiet Question Box", "A student who is afraid to ask in class can save a question privately; it becomes a starting point for a lesson, never visible to others.", "Designed for the learner who never raises a hand.", "Removes social fear from asking.", "Number of questions from previously silent students.", 3),
);

export const THESIS = {
  vision: "IntelliHorizon is a living universe of learning where every concept is a star that brightens only when a student shows real understanding.",
  problem: "Students often answer correctly while holding fragile or mistaken ideas, and most apps cannot tell a lucky or memorised answer from understanding.",
  category: "The Living Learning Universe: an AI teacher whose model of the learner is visible, contestable and built on evidence of transfer.",
  promise: "Know what you truly understand, fix what you only seem to understand, and prove it in disguise.",
  differentiation: "Understanding is certified by Shapeshifter Trials (new situation, new form, other language, argued back), diagnosed through named misconceptions with confidence, and shown on a sky the student can question.",
  why: "Because a correct answer is not the same as understanding, and every student deserves to know the difference.",
};

export const PRINCIPLES: { name: string; text: string }[] = [
  { name: "Learning first", text: "Every light, animation and screen exists because it helps a student understand or decide what to do next." },
  { name: "Predict before you are told", text: "Students commit to an idea before the explanation, so mistakes become discoveries." },
  { name: "Adaptation you can see", text: "Each personalisation states its reason, and every diagnosis can be challenged." },
  { name: "The student is in control", text: "Explanation style, language, sharing and deletion are the learner's choices." },
  { name: "Simple beats spectacular", text: "One next step, a compact navigation and plain SVG that runs on a low-cost phone." },
  { name: "Bangla first, not translated", text: "Both languages are authored, and switching is part of learning, not a setting." },
  { name: "Measure learning, not usage", text: "Success is transfer, retention and fewer misconceptions, never minutes in the app." },
  { name: "Honest AI", text: "Content is labelled, estimates show their evidence, and nothing pretends to read minds." },
];

export const FLAGSHIPS = [
  {
    name: "The Understanding Sky",
    sees: "A night sky of eight subject constellations. Three stars have dashed rings: worlds open now. Lit stars glow with a thread-gold halo; fragile ones flicker.",
    does: "Taps a star to see its NCTB chapter, its evidence and bridges to other subjects drawn as stitches; follows the single next step offered beside the sky.",
    different: "The home screen is the learner model itself. Brightness cannot be bought with time or taps, only with evidence.",
    meaningful: "Students see the difference between what is solid and what is fragile, and know what to do next in seconds.",
    judge: "A fresh sky, one lesson, then the same star visibly ignite and a bridge thread draw to Chemistry.",
    evaluate: "Students' accuracy in identifying their own fragile ideas versus later test results.",
    hard: "A chatbot has no persistent, evidence-based model to render; a quiz app's progress bar counts completions, not transfer.",
  },
  {
    name: "Misconception Mirror with Four-Way Repair",
    sees: "A prediction with a three-bead confidence choice, then a named misconception, why IntelliHorizon suspects it, and an explanation they can switch between visual, story, steps and comparison.",
    does: "Predicts, tests, reads a repair in their preferred style, or taps 'That's not what I was thinking' to overrule the diagnosis.",
    different: "The AI's interpretation is shown, explained, and contestable, and the explanation adapts to what worked for this learner.",
    meaningful: "Targets the actual mistaken idea, the leading cause of repeated errors, while protecting dignity.",
    judge: "A confident wrong answer, the named misconception, a switch from steps to story, and the Mirror updating instantly.",
    evaluate: "Recurrence of each misconception after repair; next-item success by explanation style; challenge rates.",
    hard: "Requires authored misconception maps, confidence capture and a persistent model that students can correct, not a single prompt.",
  },
  {
    name: "Teach Rumi, then Shapeshifter Trials",
    sees: "Rumi, a clearly simulated Class 5 learner, asks them to explain. Then four disguises of the same idea: a Moon landing film, a graph, a Bangla question, and a friend's wrong argument.",
    does: "Explains in their own words by typing or speaking, answers Rumi's follow-ups, then carries the idea through four disguises as the star brightens.",
    different: "Mastery is defined as explanation plus transfer across context, representation, language and argument.",
    meaningful: "Memorised answers usually fail at least one disguise; understanding survives them.",
    judge: "The student's star changing level as each disguise is survived, ending in Then and Now showing a changed belief.",
    evaluate: "Correlation of disguise survival with delayed unfamiliar test items; explanation completeness before and after.",
    hard: "The combination of teach-back, a disguise set per concept and an evidence model is a designed system, not a generated quiz.",
  },
];

export const DEFINING = {
  name: "Shapeshifter Sky",
  idea: "Understanding is certified only when an idea survives disguise. Each concept carries a set of disguises (new situation, new representation, the other language, and arguing it back) plus a next-day revisit. The sky renders the result, so a student literally sees the difference between remembering and understanding.",
  prototype: "Three concepts (falling objects, comparing fractions, where a tree's mass comes from), each with predictions, an interactive exploration, misconception repair, teach-back and four disguises, rendered on a live sky with an inspectable Mirror. This is what is running now.",
  expansion: "Disguise sets for every NCTB Grade 6 to 10 chapter authored with teachers; AI-generated disguises reviewed by teachers before release; next-day echo revisits; teacher class constellation; handwriting feedback on working.",
  future: "Students design disguises for each other; a private Proof of Understanding passport; anonymous misconception maps that help curriculum authors improve explanations across countries.",
  distinct: "Many apps adapt difficulty. Few define mastery as transfer and show it to the learner as a contestable model. The distinctive part is the combination: prediction with confidence, named misconceptions, teach-back, four-way disguise and a visible, correctable sky.",
};

export const TIERS: Record<1 | 2 | 3 | 4, { name: string; why: string }> = {
  1: { name: "Signature differentiators", why: "They define the product: evidence-based light, disguise-certified mastery, contestable diagnosis and teach-back. All are running in the prototype." },
  2: { name: "Core learning experiences", why: "Needed for a complete, credible student experience: exam focus, offline honesty, read-aloud, privacy controls and retention." },
  3: { name: "High-value expansions", why: "Strengthen the product after the core loop is validated with students and teachers." },
  4: { name: "Long-term frontier", why: "Ambitious ideas that need more evidence, partners or capabilities before building." },
};

export const AUDIT: { weak: string; problem: string; replaced: string }[] = [
  { weak: "Galaxy XP meter", problem: "A renamed progress bar that rewards usage.", replaced: "Six Kinds of Light, earned only by evidence." },
  { weak: "Daily streak with a comet trail", problem: "Punishes breaks and students with limited data.", replaced: "Light That Never Punishes Breaks plus Next-Day Echo." },
  { weak: "AI tutor chat window on every page", problem: "Any chatbot can do it and it encourages answer-seeking.", replaced: "Contextual roles: Rumi as listener, repair as explainer, Socratic hint ladder." },
  { weak: "Global leaderboard", problem: "Publicly exposes academic performance of minors.", replaced: "Class Constellation with no names unless students opt in." },
  { weak: "Learning style quiz on sign-up", problem: "Labels learners on weak evidence and slows onboarding.", replaced: "Four-Way Repair that adapts to demonstrated preference." },
  { weak: "3D planet you must fly through", problem: "Spectacle that blocks basic tasks on cheap phones.", replaced: "A 2D stitched sky with one next step and list alternatives." },
  { weak: "Predicted exam score", problem: "False precision that can harm students.", replaced: "Readiness With Uncertainty, based on a stated number of answers." },
];

export const DEMO: { t: string; beat: string; show: string }[] = [
  { t: "0:00", beat: "The problem", show: "A student answers 'both land together' correctly, but taps 'Guessing'. Most apps would mark this mastered." },
  { t: "0:20", beat: "The universe", show: "The Understanding Sky: eight constellations, three open worlds, one next step. No dashboard." },
  { t: "0:40", beat: "Signature interaction", show: "Predict in the Drop Lab, switch the air off, watch both speed lines overlap." },
  { t: "1:10", beat: "The AI difference", show: "A confident wrong answer names 'Heavier falls faster', explains why it suspects it, switches from steps to a story, and the student taps 'That's not what I was thinking' once to show control." },
  { t: "1:45", beat: "The outcome", show: "Teach Rumi in Bangla by voice, then four disguises. The star ignites to 'Survives disguises'. Then and Now shows the changed belief." },
  { t: "2:25", beat: "Global and Bangla-first", show: "Toggle to English mid-question; the language disguise; the same engine fits any curriculum's chapters." },
  { t: "2:45", beat: "Responsible AI", show: "The Mirror: every belief with its evidence, sharing off by default, delete everything." },
];

export const IDENTITY = {
  five: ["Shapeshifter Trials", "The Understanding Sky", "Misconception Mirror with Four-Way Repair", "Teach Rumi", "Tomorrow Mode with honest readiness"],
  flagship: "Teach Rumi, then Shapeshifter Trials",
  outcome: "Students who complete the disguise loop answer unfamiliar transfer questions on the same idea more accurately a week later than students who practised the same number of standard questions. This is a hypothesis to test in a controlled pilot, not a result.",
  principle: "Light is earned by evidence of understanding, and the learner can always see and question that evidence.",
  remember: "IntelliHorizon is the AI teacher that can tell the difference between remembering an answer and understanding an idea, and shows the student that difference on their own sky.",
};
