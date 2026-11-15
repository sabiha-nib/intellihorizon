import type { Idea, LessonPack, Misconception, Question } from "./types";

const IDEAS: Idea[] = [
  { id: "same", label: { en: "Without air, everything falls at the same rate", bn: "বাতাস না থাকলে সবকিছু একই হারে পড়ে" }, keys: ["same time", "same rate", "together", "same speed", "equal", "at once", "simultaneous", "একসাথে", "একই সময়", "সমান", "একই হারে", "একই গতিতে", "একই বেগে"], rumiAsks: { en: "So do they land at the same time or not?", bn: "তাহলে কি ওরা একই সময়ে পড়ে, নাকি না?" } },
  { id: "mass", label: { en: "Heavier means more pull but also harder to speed up", bn: "ভারী মানে টান বেশি, কিন্তু গতি বাড়ানোও কঠিন" }, keys: ["mass", "heavier", "heavy", "harder to", "inertia", "cancel", "ভর", "ভারী", "জড়তা", "বাদ", "কঠিন"], rumiAsks: { en: "But gravity pulls the big stone harder. Doesn't that make it faster?", bn: "কিন্তু অভিকর্ষ তো বড় পাথরকে বেশি টানে। তাহলে ওটা দ্রুত হবে না?" } },
  { id: "air", label: { en: "Air pushes back, mostly on light, wide things", bn: "বাতাস বাধা দেয়, বিশেষ করে হালকা ও চওড়া জিনিসে" }, keys: ["air", "resistance", "drag", "wind", "বাতাস", "বায়ু", "বাধা", "প্রতিরোধ"], rumiAsks: { en: "Then why does a feather float down so slowly at home?", bn: "তাহলে বাড়িতে পালক এত আস্তে নামে কেন?" } },
  { id: "gravity", label: { en: "Gravity gives every object the same acceleration", bn: "অভিকর্ষ সব বস্তুকে একই ত্বরণ দেয়" }, keys: ["gravity", "9.8", "acceleration", "accelerate", "অভিকর্ষ", "মহাকর্ষ", "ত্বরণ", "৯.৮"], rumiAsks: { en: "What is actually pulling them down?", bn: "আসলে কী ওদের নিচে টানছে?" } },
];

const MISC: Misconception[] = [
  { id: "heavier-faster", name: { en: "Heavier falls faster", bn: "ভারী জিনিস আগে পড়ে" }, looksLike: { en: "Expecting the heavier object to land first when air hardly matters.", bn: "বাতাসের প্রভাব কম থাকলেও ভারী বস্তু আগে পড়বে বলে ভাবা।" }, repair: {
    visual: { en: "Open the Drop Lab, switch the air off and drop the 1 kg and 5 kg stones together. Watch their speed lines: they stay on top of each other the whole way down.", bn: "ড্রপ ল্যাবে বাতাস বন্ধ করে ১ কেজি আর ৫ কেজির পাথর একসাথে ফেলো। বেগের রেখা দুটো পুরো পথে একটার ওপর আরেকটা থাকে।" },
    story: { en: "Your little brother and your father sit on two identical bicycles at the top of the same slope. Gravity pulls your father harder, but he is also harder to get moving. The two effects cancel, and they roll down side by side.", bn: "তোমার ছোট ভাই আর বাবা একই ঢালের মাথায় দুটি একই রকম সাইকেলে বসে আছে। অভিকর্ষ বাবাকে বেশি টানে, কিন্তু বাবাকে চালু করাও কঠিন। দুটো প্রভাব কাটাকাটি হয়ে যায়, তাই তারা পাশাপাশি নামে।" },
    steps: { en: "1. Gravity's pull grows with mass: 5 kg is pulled 5 times harder. 2. But 5 kg also needs 5 times more push to speed up. 3. Five times the pull on five times the mass gives the same acceleration. 4. So both land together.", bn: "১. ভর যত, টানও তত: ৫ কেজিকে ৫ গুণ বেশি টানে। ২. কিন্তু ৫ কেজির গতি বাড়াতে ৫ গুণ বেশি বল লাগে। ৩. ৫ গুণ টান ভাগ ৫ গুণ ভর মানে একই ত্বরণ। ৪. তাই দুটোই একসাথে পড়ে।" },
    analogy: { en: "It is like sharing rotis: 5 rotis for 5 people or 1 roti for 1 person. Everyone still gets exactly one. Every kilogram gets the same pull.", bn: "এটা রুটি ভাগের মতো: ৫ জনের জন্য ৫টা রুটি বা ১ জনের জন্য ১টা। সবাই ঠিক একটা করেই পায়। প্রতিটি কেজি একই টান পায়।" },
  } },
  { id: "air-is-gravity", name: { en: "Slow falling means weak gravity", bn: "ধীরে পড়া মানে অভিকর্ষ দুর্বল" }, looksLike: { en: "Thinking a feather drifts down because gravity barely pulls it, instead of air pushing back.", bn: "ভাবা যে অভিকর্ষ পালককে কম টানে বলে ধীরে নামে, অথচ আসলে বাতাস বাধা দেয়।" }, repair: {
    visual: { en: "Drop the feather with air on, then with air off. Gravity did not change between the two runs. Only the air did.", bn: "বাতাস চালু রেখে পালক ফেলো, তারপর বাতাস বন্ধ করে। দুবারেই অভিকর্ষ একই ছিল। বদলেছে শুধু বাতাস।" },
    story: { en: "Hold an open umbrella out of a moving bus window. Something pushes it back hard. That push is air, and a feather feels the same push while it falls.", bn: "চলন্ত বাসের জানালা দিয়ে খোলা ছাতা বের করে ধরো। জোরে পেছনে ঠেলে। ওই ঠেলাটাই বাতাস, পড়ন্ত পালকও একই ঠেলা পায়।" },
    steps: { en: "1. Gravity pulls down on everything. 2. Air pushes up on moving things. 3. A light, wide feather gets a big push compared with its small pull. 4. Remove the air and the feather falls like a stone.", bn: "১. অভিকর্ষ সবকিছুকে নিচে টানে। ২. বাতাস চলমান জিনিসকে উপরে ঠেলে। ৩. হালকা, চওড়া পালকের টানের তুলনায় ঠেলা অনেক বেশি। ৪. বাতাস সরালে পালক পাথরের মতো পড়ে।" },
    analogy: { en: "Walking into a strong wind is slower, but the road is not less steep. The wind is the air, the slope is gravity.", bn: "জোরালো বাতাসের বিপরীতে হাঁটলে ধীর লাগে, কিন্তু রাস্তার ঢাল কমে না। বাতাস হলো বায়ু, ঢাল হলো অভিকর্ষ।" },
  } },
  { id: "moon-no-gravity", name: { en: "No gravity on the Moon", bn: "চাঁদে অভিকর্ষ নেই" }, looksLike: { en: "Expecting objects to float on the Moon because there is no air.", bn: "বাতাস নেই বলে চাঁদে জিনিস ভেসে থাকবে বলে ভাবা।" }, repair: {
    visual: { en: "Switch the Drop Lab to the Moon. Things still fall, just more gently, because the Moon's pull is about one sixth of Earth's.", bn: "ড্রপ ল্যাবকে চাঁদে নিয়ে যাও। জিনিস এখনো পড়ে, শুধু আস্তে, কারণ চাঁদের টান পৃথিবীর প্রায় ছয় ভাগের এক ভাগ।" },
    story: { en: "Astronauts walked and jumped on the Moon and always came back down. No air does not mean no gravity.", bn: "নভোচারীরা চাঁদে হেঁটেছেন, লাফিয়েছেন, আর সবসময় নিচে নেমে এসেছেন। বাতাস না থাকা মানে অভিকর্ষ না থাকা নয়।" },
    steps: { en: "1. Gravity comes from mass, not from air. 2. The Moon has mass, so it pulls. 3. Its pull is weaker, about 1.6 m/s² instead of 9.8 m/s². 4. Without air, a hammer and a feather fall together there.", bn: "১. অভিকর্ষ আসে ভর থেকে, বাতাস থেকে নয়। ২. চাঁদের ভর আছে, তাই টানে। ৩. টান দুর্বল, ৯.৮ এর বদলে প্রায় ১.৬ মি/সে²। ৪. বাতাস নেই বলে সেখানে হাতুড়ি আর পালক একসাথে পড়ে।" },
    analogy: { en: "Air is like water in a pond and gravity is like the slope of the bank. Drain the pond and the slope is still there.", bn: "বাতাস যেন পুকুরের পানি, অভিকর্ষ যেন পাড়ের ঢাল। পুকুর শুকিয়ে গেলেও ঢাল থাকে।" },
  } },
];

MISC.push(
  { id: "constant-speed", name: { en: "Falling at a steady speed", bn: "পড়ন্ত বস্তুর বেগ একই থাকে" }, looksLike: { en: "Drawing a falling object's speed as a flat line instead of a rising one.", bn: "পড়ন্ত বস্তুর বেগকে সমান রেখা হিসেবে আঁকা, অথচ তা বাড়তে থাকে।" }, repair: {
    visual: { en: "Watch the speed readout in the Drop Lab: it climbs by about 9.8 m/s every second until the object lands.", bn: "ড্রপ ল্যাবের বেগের হিসাব দেখো: মাটিতে পড়া পর্যন্ত প্রতি সেকেন্ডে প্রায় ৯.৮ মি/সে বাড়ে।" },
    story: { en: "A mango falling from a tall branch hurts more than one from a low branch. It had more time to speed up.", bn: "উঁচু ডাল থেকে পড়া আম নিচু ডালের আমের চেয়ে জোরে লাগে। গতি বাড়ানোর সময় বেশি পেয়েছে।" },
    steps: { en: "1. Gravity keeps pulling the whole time. 2. A steady pull means steady speeding up. 3. So the speed-time graph is a rising straight line.", bn: "১. অভিকর্ষ সারাক্ষণ টানে। ২. একটানা টান মানে একটানা গতি বৃদ্ধি। ৩. তাই বেগ-সময় লেখচিত্র একটি উঠন্ত সরলরেখা।" },
    analogy: { en: "It is like a savings box that gets 10 taka every day. The total keeps growing.", bn: "প্রতিদিন ১০ টাকা জমানো ব্যাংকের মতো। মোট টাকা বাড়তেই থাকে।" },
  } },
  { id: "same-force", name: { en: "Gravity pulls everything equally hard", bn: "অভিকর্ষ সবাইকে সমান জোরে টানে" }, looksLike: { en: "Mixing up equal acceleration with equal force.", bn: "সমান ত্বরণকে সমান বল ভেবে গুলিয়ে ফেলা।" }, repair: {
    visual: { en: "Put both stones on a scale. The 5 kg stone weighs five times more: gravity pulls it harder. Yet in the Drop Lab they still land together.", bn: "দুটি পাথর দাঁড়িপাল্লায় রাখো। ৫ কেজির পাথরের ওজন ৫ গুণ: অভিকর্ষ ওটাকে বেশি টানে। তবুও ড্রপ ল্যাবে দুটো একসাথে পড়ে।" },
    story: { en: "Lifting a full water pot is harder than lifting an empty one. That difference is gravity pulling harder on more mass.", bn: "ভরা কলস তোলা খালি কলসের চেয়ে কঠিন। এই পার্থক্যই বেশি ভরের ওপর অভিকর্ষের বেশি টান।" },
    steps: { en: "1. Force of gravity (weight) = mass × 9.8. 2. Bigger mass, bigger force. 3. Acceleration = force ÷ mass = 9.8 for everyone.", bn: "১. অভিকর্ষ বল (ওজন) = ভর × ৯.৮। ২. ভর বেশি, বল বেশি। ৩. ত্বরণ = বল ÷ ভর = সবার জন্য ৯.৮।" },
    analogy: { en: "A bigger class gets more total rice, but every student gets the same plate.", bn: "বড় ক্লাস মোট চাল বেশি পায়, কিন্তু প্রত্যেক ছাত্র একই প্লেট পায়।" },
  } },
);

const PROBE: Question[] = [
  { id: "fall.p1", concept: "fall", kind: "probe", prompt: { en: "You drop a 5 kg stone and a 1 kg stone from the same roof at the same moment. Air hardly affects stones. Which lands first?", bn: "একই ছাদ থেকে একই সময়ে ৫ কেজি ও ১ কেজির দুটি পাথর ফেললে কোনটি আগে পড়বে? পাথরের ওপর বাতাসের প্রভাব খুব কম।" }, options: [
    { id: "a", text: { en: "The 5 kg stone", bn: "৫ কেজির পাথর" }, misconception: "heavier-faster" },
    { id: "b", text: { en: "Both land together", bn: "দুটো একসাথে" }, correct: true },
    { id: "c", text: { en: "The 1 kg stone", bn: "১ কেজির পাথর" } },
    { id: "d", text: { en: "It depends on the height of the roof", bn: "ছাদের উচ্চতার ওপর নির্ভর করে" } },
  ], explain: { en: "Gravity gives every object the same acceleration, so without much air both stones land together.", bn: "অভিকর্ষ সব বস্তুকে একই ত্বরণ দেয়, তাই বাতাসের প্রভাব কম হলে দুটো পাথর একসাথে পড়ে।" }, source: "verified" },
  { id: "fall.p2", concept: "fall", kind: "probe", prompt: { en: "A flat sheet of paper drifts down slowly. Why?", bn: "একটি সমান কাগজ ধীরে ধীরে নামে। কেন?" }, options: [
    { id: "a", text: { en: "Air pushes back on its wide surface", bn: "চওড়া পৃষ্ঠে বাতাস বাধা দেয়" }, correct: true },
    { id: "b", text: { en: "Gravity barely pulls on light things", bn: "হালকা জিনিসকে অভিকর্ষ প্রায় টানেই না" }, misconception: "air-is-gravity" },
    { id: "c", text: { en: "Paper falls at a steady slow speed by nature", bn: "কাগজ স্বভাবতই একই ধীর বেগে পড়ে" }, misconception: "constant-speed" },
  ], explain: { en: "Gravity pulls the paper as usual. Air resistance on the wide sheet is what slows it.", bn: "অভিকর্ষ কাগজকে স্বাভাবিকভাবেই টানে। চওড়া পাতায় বাতাসের বাধাই একে ধীর করে।" }, source: "verified" },
];

const EXAM: Question[] = [
  { id: "fall.e1", concept: "fall", kind: "exam", prompt: { en: "A ball is dropped from rest. Ignoring air, about how fast is it moving after 2 seconds? (g ≈ 9.8 m/s²)", bn: "স্থির অবস্থা থেকে একটি বল ছাড়া হলো। বাতাস উপেক্ষা করলে ২ সেকেন্ড পর এর বেগ প্রায় কত? (g ≈ ৯.৮ মি/সে²)" }, options: [
    { id: "a", text: { en: "9.8 m/s", bn: "৯.৮ মি/সে" }, misconception: "constant-speed" },
    { id: "b", text: { en: "19.6 m/s", bn: "১৯.৬ মি/সে" }, correct: true },
    { id: "c", text: { en: "4.9 m/s", bn: "৪.৯ মি/সে" } },
    { id: "d", text: { en: "39.2 m/s", bn: "৩৯.২ মি/সে" } },
  ], explain: { en: "v = g × t = 9.8 × 2 = 19.6 m/s.", bn: "v = g × t = ৯.৮ × ২ = ১৯.৬ মি/সে।" }, source: "verified" },
  { id: "fall.e2", concept: "fall", kind: "exam", prompt: { en: "Why does a parachute slow a skydiver down?", bn: "প্যারাসুট কেন স্কাইডাইভারের গতি কমায়?" }, options: [
    { id: "a", text: { en: "It greatly increases air resistance", bn: "এটি বাতাসের বাধা অনেক বাড়ায়" }, correct: true },
    { id: "b", text: { en: "It reduces the pull of gravity", bn: "এটি অভিকর্ষের টান কমায়" }, misconception: "air-is-gravity" },
    { id: "c", text: { en: "It makes the skydiver lighter", bn: "এটি স্কাইডাইভারকে হালকা করে" } },
  ], explain: { en: "Gravity is unchanged. The large canopy catches a lot of air, which pushes upward.", bn: "অভিকর্ষ একই থাকে। বড় ছাউনি অনেক বাতাস ধরে, যা উপরের দিকে ঠেলে।" }, source: "verified" },
  { id: "fall.e3", concept: "fall", kind: "exam", prompt: { en: "Which quantity is the same for all objects falling freely near Earth with no air?", bn: "বাতাসহীন অবস্থায় পৃথিবীর কাছে মুক্তভাবে পড়ন্ত সব বস্তুর কোন রাশিটি একই?" }, options: [
    { id: "a", text: { en: "Acceleration", bn: "ত্বরণ" }, correct: true },
    { id: "b", text: { en: "Weight", bn: "ওজন" }, misconception: "same-force" },
    { id: "c", text: { en: "Mass", bn: "ভর" } },
    { id: "d", text: { en: "Momentum", bn: "ভরবেগ" } },
  ], explain: { en: "All free-falling objects accelerate at about 9.8 m/s², whatever their weight.", bn: "ওজন যাই হোক, মুক্তভাবে পড়ন্ত সব বস্তুর ত্বরণ প্রায় ৯.৮ মি/সে²।" }, source: "verified" },
];

const TRIALS: Question[] = [
  { id: "fall.t.context", concept: "fall", kind: "trial", disguise: "context", prompt: { en: "In 1971, astronaut David Scott dropped a hammer and a falcon feather on the Moon at the same moment. The Moon has no air. What did the camera show?", bn: "১৯৭১ সালে নভোচারী ডেভিড স্কট চাঁদে একই সময়ে একটি হাতুড়ি আর একটি বাজপাখির পালক ছেড়েছিলেন। চাঁদে বাতাস নেই। ক্যামেরায় কী দেখা গেল?" }, options: [
    { id: "a", text: { en: "Both landed together", bn: "দুটো একসাথে পড়ল" }, correct: true },
    { id: "b", text: { en: "The hammer landed first", bn: "হাতুড়ি আগে পড়ল" }, misconception: "heavier-faster" },
    { id: "c", text: { en: "Both floated, there is no gravity on the Moon", bn: "দুটোই ভেসে রইল, চাঁদে অভিকর্ষ নেই" }, misconception: "moon-no-gravity" },
    { id: "d", text: { en: "The feather drifted down slowly", bn: "পালক ধীরে ধীরে নামল" }, misconception: "air-is-gravity" },
  ], explain: { en: "With no air, only gravity acts, and it gives both the same acceleration. The Apollo 15 film shows them landing together.", bn: "বাতাস না থাকায় শুধু অভিকর্ষ কাজ করে এবং দুটোকে একই ত্বরণ দেয়। অ্যাপোলো ১৫-এর ভিডিওতে দুটো একসাথে পড়ে।" }, source: "historical" },
  { id: "fall.t.representation", concept: "fall", kind: "trial", disguise: "representation", prompt: { en: "These speed-time graphs show a 1 kg ball and a 5 kg ball falling in a vacuum tube. Which graph is right?", bn: "এই বেগ-সময় লেখচিত্রগুলো একটি বায়ুশূন্য নলে ১ কেজি ও ৫ কেজির বল পড়া দেখায়। কোনটি সঠিক?" }, options: [
    { id: "a", text: { en: "Graph A", bn: "লেখচিত্র ক" }, correct: true, graph: [{ pts: [[0, 0], [100, 88]], label: "1 kg" }, { pts: [[0, 3], [100, 91]], label: "5 kg" }] },
    { id: "b", text: { en: "Graph B", bn: "লেখচিত্র খ" }, misconception: "heavier-faster", graph: [{ pts: [[0, 0], [100, 45]], label: "1 kg" }, { pts: [[0, 0], [100, 92]], label: "5 kg" }] },
    { id: "c", text: { en: "Graph C", bn: "লেখচিত্র গ" }, misconception: "constant-speed", graph: [{ pts: [[0, 40], [100, 40]], label: "1 kg" }, { pts: [[0, 46], [100, 46]], label: "5 kg" }] },
  ], explain: { en: "Both speeds rise at the same steady rate, so their lines lie on top of each other.", bn: "দুটো বেগই একই হারে বাড়ে, তাই রেখা দুটো একটার ওপর আরেকটা থাকে।" }, source: "verified" },
  { id: "fall.t.language", concept: "fall", kind: "trial", disguise: "language", prompt: { en: "A 10 kg iron ball and a 1 kg iron ball are released together from the same height. Air has very little effect. Which reaches the ground first?", bn: "একই উচ্চতা থেকে ১০ কেজি ও ১ কেজির দুটি লোহার বল একসাথে ছেড়ে দেওয়া হলো। বাতাসের প্রভাব খুব কম। কোনটি আগে মাটিতে পৌঁছাবে?" }, options: [
    { id: "a", text: { en: "Both at almost the same time", bn: "প্রায় একই সময়ে দুটোই" }, correct: true },
    { id: "b", text: { en: "The 10 kg ball", bn: "১০ কেজির বল" }, misconception: "heavier-faster" },
    { id: "c", text: { en: "The 1 kg ball", bn: "১ কেজির বল" } },
  ], explain: { en: "Same idea, different language: equal acceleration means they land together.", bn: "একই ধারণা, ভিন্ন ভাষা: সমান ত্বরণ মানে একসাথে পড়া।" }, source: "verified" },
  { id: "fall.t.reverse", concept: "fall", kind: "trial", disguise: "reverse", prompt: { en: "Rafi says: \"Gravity pulls the 5 kg stone 5 times harder, so it must fall 5 times faster.\" What is the best reply?", bn: "রাফি বলে: \"অভিকর্ষ ৫ কেজির পাথরকে ৫ গুণ বেশি টানে, তাই এটা ৫ গুণ দ্রুত পড়বে।\" সবচেয়ে ভালো উত্তর কোনটি?" }, options: [
    { id: "a", text: { en: "True about the pull, but it has 5 times more mass to speed up, so it falls at the same rate", bn: "টানের কথা ঠিক, কিন্তু এর গতি বাড়াতে ৫ গুণ ভর সামলাতে হয়, তাই একই হারে পড়ে" }, correct: true },
    { id: "b", text: { en: "Rafi is right", bn: "রাফি ঠিক বলেছে" }, misconception: "heavier-faster" },
    { id: "c", text: { en: "Gravity pulls every object with exactly the same force", bn: "অভিকর্ষ সব বস্তুকে ঠিক একই বলে টানে" }, misconception: "same-force" },
  ], explain: { en: "Rafi has half the story. The bigger pull is exactly balanced by the bigger mass.", bn: "রাফি অর্ধেক গল্প বলেছে। বেশি টান ঠিক বেশি ভর দিয়ে সমান হয়ে যায়।" }, source: "verified" },
];

export const FALL: LessonPack = {
  concept: "fall",
  rumiOpening: {
    en: "My big brother says heavy things always fall faster. That makes sense to me. Why would a big stone and a small stone land together?",
    bn: "আমার বড় ভাই বলে ভারী জিনিস সবসময় আগে পড়ে। আমারও তাই মনে হয়। বড় পাথর আর ছোট পাথর একসাথে পড়বে কেন?",
  },
  ideas: IDEAS,
  misconceptions: MISC,
  probe: PROBE,
  trials: TRIALS,
  exam: EXAM,
};
