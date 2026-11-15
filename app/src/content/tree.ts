import type { Idea, L, LessonPack, Misconception, Question } from "./types";

const IDEAS: Idea[] = [
  { id: "co2", label: { en: "Most of the mass comes from carbon dioxide in the air", bn: "ভরের বেশিরভাগ আসে বাতাসের কার্বন ডাই-অক্সাইড থেকে" }, keys: ["carbon dioxide", "co2", "air", "carbon", "কার্বন", "বাতাস", "বায়ু"], rumiAsks: { en: "Air? But air weighs nothing!", bn: "বাতাস? বাতাসের তো কোনো ওজন নেই!" } },
  { id: "water", label: { en: "Water adds hydrogen (and the oxygen that is released)", bn: "পানি দেয় হাইড্রোজেন (আর যে অক্সিজেন বের হয়)" }, keys: ["water", "h2o", "hydrogen", "পানি", "জল", "হাইড্রোজেন"], rumiAsks: { en: "What about the water we pour on it?", bn: "আমরা যে পানি দিই তার কী হয়?" } },
  { id: "light", label: { en: "Sunlight gives energy, not material", bn: "সূর্যালোক শক্তি দেয়, উপাদান নয়" }, keys: ["energy", "light", "sun", "শক্তি", "আলো", "সূর্য"], rumiAsks: { en: "Isn't the tree made of sunlight?", bn: "গাছ কি সূর্যের আলো দিয়ে তৈরি না?" } },
  { id: "soil", label: { en: "Soil gives only small amounts of minerals", bn: "মাটি শুধু অল্প খনিজ দেয়" }, keys: ["soil", "mineral", "little", "small amount", "মাটি", "খনিজ", "অল্প", "সামান্য"], rumiAsks: { en: "Then what does the soil do?", bn: "তাহলে মাটির কাজ কী?" } },
];

const MISC: Misconception[] = [
  { id: "mass-from-soil", name: { en: "Plants are built from soil", bn: "গাছ মাটি খেয়ে বড় হয়" }, looksLike: { en: "Expecting the soil to be used up as the tree grows.", bn: "গাছ বড় হলে মাটি কমে যাবে বলে ভাবা।" }, repair: {
    visual: { en: "Look at the willow evidence: the tree gained about 74 kg while the soil lost only about 57 g.", bn: "উইলো গাছের প্রমাণ দেখো: গাছের ভর প্রায় ৭৪ কেজি বেড়েছে, আর মাটি কমেছে মাত্র প্রায় ৫৭ গ্রাম।" },
    story: { en: "If trees ate soil, every forest would sit in a deep pit. The ground under old mango trees is not sinking.", bn: "গাছ যদি মাটি খেত, তবে প্রতিটি বন গভীর গর্তে বসে থাকত। পুরোনো আমগাছের নিচের মাটি তো দেবে যায় না।" },
    steps: { en: "1. Weigh soil before and after: it barely changes. 2. Dry wood is about half carbon. 3. Soil holds little carbon, air holds CO₂. 4. So the carbon must come from the air.", bn: "১. আগে-পরে মাটি মাপো: প্রায় একই থাকে। ২. শুকনো কাঠের প্রায় অর্ধেক কার্বন। ৩. মাটিতে কার্বন কম, বাতাসে CO₂ আছে। ৪. তাই কার্বন আসে বাতাস থেকে।" },
    analogy: { en: "Soil is like the vitamins in your diet: important, but not what most of your body is built from.", bn: "মাটি যেন খাবারের ভিটামিন: জরুরি, কিন্তু শরীরের বেশিরভাগ তা দিয়ে তৈরি নয়।" },
  } },
  { id: "light-is-food", name: { en: "Sunlight turns into wood", bn: "সূর্যের আলো কাঠে পরিণত হয়" }, looksLike: { en: "Thinking light itself becomes the plant's material.", bn: "ভাবা যে আলো নিজেই গাছের উপাদান হয়ে যায়।" }, repair: {
    visual: { en: "In the equation 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂, light is written above the arrow, not as an ingredient. It powers the change.", bn: "৬CO₂ + ৬H₂O → C₆H₁₂O₆ + ৬O₂ সমীকরণে আলো লেখা থাকে তীরের ওপরে, উপাদান হিসেবে নয়। এটি পরিবর্তনের শক্তি জোগায়।" },
    story: { en: "A rice cooker needs electricity, but the rice is not made of electricity. Light is the plant's electricity.", bn: "রাইস কুকারে বিদ্যুৎ লাগে, কিন্তু ভাত বিদ্যুৎ দিয়ে তৈরি নয়। আলো হলো গাছের বিদ্যুৎ।" },
    steps: { en: "1. Matter is made of atoms. 2. Light carries energy but no atoms. 3. The atoms in sugar come from CO₂ and water.", bn: "১. পদার্থ পরমাণু দিয়ে তৈরি। ২. আলো শক্তি বহন করে, পরমাণু নয়। ৩. চিনির পরমাণু আসে CO₂ আর পানি থেকে।" },
    analogy: { en: "Light is the cook's fire, not the ingredients in the pot.", bn: "আলো হলো রাঁধুনির আগুন, হাঁড়ির উপকরণ নয়।" },
  } },
  { id: "water-only", name: { en: "Plants are made only of water", bn: "গাছ শুধু পানি দিয়ে তৈরি" }, looksLike: { en: "Treating water as the only building material.", bn: "পানিকেই একমাত্র উপাদান ভাবা।" }, repair: {
    visual: { en: "Dry a leaf completely. What remains is mostly built from carbon, which water does not contain.", bn: "একটি পাতা পুরো শুকিয়ে নাও। যা থাকে তার বেশিরভাগ কার্বন দিয়ে তৈরি, যা পানিতে নেই।" },
    story: { en: "Water is a real ingredient, but if you dry wood the water leaves and solid wood remains.", bn: "পানি সত্যিই একটি উপাদান, কিন্তু কাঠ শুকালে পানি চলে যায় আর শক্ত কাঠ থেকে যায়।" },
    steps: { en: "1. Water is H₂O: hydrogen and oxygen only. 2. Sugar and wood contain carbon. 3. The carbon comes from CO₂.", bn: "১. পানি H₂O: শুধু হাইড্রোজেন আর অক্সিজেন। ২. চিনি ও কাঠে কার্বন আছে। ৩. কার্বন আসে CO₂ থেকে।" },
    analogy: { en: "Water is like the flour's water in roti dough: needed, but not the whole roti.", bn: "রুটির খামিরের পানির মতো: লাগে, কিন্তু পুরো রুটি নয়।" },
  } },
  { id: "gas-no-mass", name: { en: "Gases have no mass", bn: "গ্যাসের কোনো ভর নেই" }, looksLike: { en: "Believing air cannot add weight to anything.", bn: "বাতাস কোনো কিছুর ওজন বাড়াতে পারে না বলে ভাবা।" }, repair: {
    visual: { en: "A flat football and a pumped football: the pumped one is slightly heavier. The extra is air.", bn: "চুপসানো আর ফোলানো ফুটবল: ফোলানোটা সামান্য ভারী। বাড়তিটুকু বাতাস।" },
    story: { en: "A gas cylinder in the kitchen gets lighter as the gas is used up. Gas has mass.", bn: "রান্নাঘরের গ্যাস সিলিন্ডার গ্যাস ফুরালে হালকা হয়। গ্যাসের ভর আছে।" },
    steps: { en: "1. Gases are made of particles. 2. Every particle has mass. 3. So air has mass, about 1.2 kg per cubic metre.", bn: "১. গ্যাস কণা দিয়ে তৈরি। ২. প্রতিটি কণার ভর আছে। ৩. তাই বাতাসের ভর আছে, প্রতি ঘনমিটারে প্রায় ১.২ কেজি।" },
    analogy: { en: "A crowd of tiny people is still heavy, even if each one is small.", bn: "ছোট ছোট মানুষের ভিড়ও ভারী, যদিও প্রত্যেকে ছোট।" },
  } },
];

export type EvidenceCard = { id: string; text: L; source: L; kind: "historical" | "verified"; points: "air" | "against-soil" | "against-light" | "water" | "soil-small" };

export const TREE_EVIDENCE: EvidenceCard[] = [
  { id: "willow", kind: "historical", source: { en: "Jan Baptist van Helmont, 1640s", bn: "ইয়ান ব্যাপটিস্ট ফন হেলমন্ট, ১৬৪০-এর দশক" }, text: { en: "A willow grew from about 2.3 kg to about 77 kg in five years. The soil in its pot lost only about 57 g.", bn: "পাঁচ বছরে একটি উইলো গাছ প্রায় ২.৩ কেজি থেকে প্রায় ৭৭ কেজি হলো। টবের মাটি কমল মাত্র প্রায় ৫৭ গ্রাম।" }, points: "against-soil" },
  { id: "carbon", kind: "verified", source: { en: "Wood chemistry", bn: "কাঠের রসায়ন" }, text: { en: "Dry wood is roughly half carbon by mass.", bn: "শুকনো কাঠের ভরের প্রায় অর্ধেক কার্বন।" }, points: "air" },
  { id: "stomata", kind: "verified", source: { en: "Leaf structure", bn: "পাতার গঠন" }, text: { en: "Leaves take in carbon dioxide from the air through tiny pores called stomata.", bn: "পাতা পত্ররন্ধ্র নামের ছোট ছিদ্র দিয়ে বাতাস থেকে কার্বন ডাই-অক্সাইড নেয়।" }, points: "air" },
  { id: "light", kind: "verified", source: { en: "Physics of light", bn: "আলোর পদার্থবিজ্ঞান" }, text: { en: "Light is energy. It powers photosynthesis but brings no atoms.", bn: "আলো শক্তি। এটি সালোকসংশ্লেষণে শক্তি জোগায়, কিন্তু কোনো পরমাণু আনে না।" }, points: "against-light" },
  { id: "equation", kind: "verified", source: { en: "Photosynthesis equation", bn: "সালোকসংশ্লেষণের সমীকরণ" }, text: { en: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂, powered by light.", bn: "৬CO₂ + ৬H₂O → C₆H₁₂O₆ + ৬O₂, আলোর শক্তিতে।" }, points: "water" },
  { id: "minerals", kind: "verified", source: { en: "Plant nutrition", bn: "উদ্ভিদের পুষ্টি" }, text: { en: "Plants do take minerals such as nitrogen and potassium from soil, but in small amounts.", bn: "গাছ মাটি থেকে নাইট্রোজেন, পটাশিয়ামের মতো খনিজ নেয়, তবে অল্প পরিমাণে।" }, points: "soil-small" },
];

const q = (id: string, kind: Question["kind"], prompt: Question["prompt"], options: Question["options"], explain: Question["explain"], disguise?: Question["disguise"]): Question => ({ id, concept: "tree", kind, prompt, options, explain, disguise, source: "verified" });

const PROBE: Question[] = [
  q("tree.p1", "probe", { en: "A mango seed grows into a tree weighing several tonnes. Where does most of its dry mass come from?", bn: "একটি আমের আঁটি থেকে কয়েক টন ওজনের গাছ হয়। এর শুকনো ভরের বেশিরভাগ কোথা থেকে আসে?" }, [
    { id: "a", text: { en: "The soil", bn: "মাটি" }, misconception: "mass-from-soil" },
    { id: "b", text: { en: "Sunlight", bn: "সূর্যের আলো" }, misconception: "light-is-food" },
    { id: "c", text: { en: "Carbon dioxide from the air", bn: "বাতাসের কার্বন ডাই-অক্সাইড" }, correct: true },
    { id: "d", text: { en: "Water", bn: "পানি" }, misconception: "water-only" },
  ], { en: "Most dry mass is carbon, and that carbon comes from CO₂ in the air.", bn: "শুকনো ভরের বেশিরভাগ কার্বন, আর সেই কার্বন আসে বাতাসের CO₂ থেকে।" }),
  q("tree.p2", "probe", { en: "Can a gas like carbon dioxide add mass to something?", bn: "কার্বন ডাই-অক্সাইডের মতো গ্যাস কি কোনো কিছুর ভর বাড়াতে পারে?" }, [
    { id: "a", text: { en: "Yes, gases are made of particles that have mass", bn: "হ্যাঁ, গ্যাস ভরযুক্ত কণা দিয়ে তৈরি" }, correct: true },
    { id: "b", text: { en: "No, gases weigh nothing", bn: "না, গ্যাসের কোনো ওজন নেই" }, misconception: "gas-no-mass" },
  ], { en: "Every gas particle has mass. A pumped football is heavier than a flat one.", bn: "প্রতিটি গ্যাস কণার ভর আছে। ফোলানো ফুটবল চুপসানোটার চেয়ে ভারী।" }),
];

const TRIALS: Question[] = [
  q("tree.t.context", "trial", { en: "A pumpkin vine on your roof grows a 10 kg pumpkin in a small pot. The pot's soil barely changes. Where did most of the pumpkin's dry mass come from?", bn: "ছাদের ছোট টবে একটি মিষ্টিকুমড়া গাছে ১০ কেজির কুমড়া হলো। টবের মাটি প্রায় একই আছে। কুমড়ার শুকনো ভরের বেশিরভাগ কোথা থেকে এল?" }, [
    { id: "a", text: { en: "Carbon dioxide from the air", bn: "বাতাসের কার্বন ডাই-অক্সাইড" }, correct: true },
    { id: "b", text: { en: "The soil", bn: "মাটি" }, misconception: "mass-from-soil" },
    { id: "c", text: { en: "Sunlight", bn: "সূর্যের আলো" }, misconception: "light-is-food" },
  ], { en: "Same pattern as the willow: the soil hardly changes, the carbon comes from air.", bn: "উইলোর মতোই: মাটি প্রায় বদলায় না, কার্বন আসে বাতাস থেকে।" }, "context"),
  q("tree.t.representation", "trial", { en: "In 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂, which input supplies the carbon atoms in glucose?", bn: "৬CO₂ + ৬H₂O → C₆H₁₂O₆ + ৬O₂ সমীকরণে গ্লুকোজের কার্বন পরমাণু কোন উপাদান থেকে আসে?" }, [
    { id: "a", text: { en: "CO₂", bn: "CO₂" }, correct: true },
    { id: "b", text: { en: "H₂O", bn: "H₂O" }, misconception: "water-only" },
    { id: "c", text: { en: "Light", bn: "আলো" }, misconception: "light-is-food" },
  ], { en: "Only CO₂ contains carbon among the inputs.", bn: "উপাদানগুলোর মধ্যে শুধু CO₂-তে কার্বন আছে।" }, "representation"),
  q("tree.t.language", "trial", { en: "When a rice plant grows, where does most of its dry mass come from?", bn: "একটি ধানগাছ বড় হলে তার শুকনো ভরের বেশিরভাগ কোথা থেকে আসে?" }, [
    { id: "a", text: { en: "Carbon dioxide in the air", bn: "বাতাসের কার্বন ডাই-অক্সাইড" }, correct: true },
    { id: "b", text: { en: "The paddy soil", bn: "ধানক্ষেতের মাটি" }, misconception: "mass-from-soil" },
    { id: "c", text: { en: "Sunlight", bn: "সূর্যের আলো" }, misconception: "light-is-food" },
  ], { en: "Rice plants build their carbon from CO₂, just like trees.", bn: "গাছের মতোই ধানগাছও CO₂ থেকে কার্বন নেয়।" }, "language"),
  q("tree.t.reverse", "trial", { en: "A sealed glass jar holding a plant, soil and water sits in sunlight for a week. What happens to the total mass of the sealed jar?", bn: "গাছ, মাটি আর পানিসহ একটি বন্ধ কাচের বয়াম এক সপ্তাহ রোদে রাখা হলো। বন্ধ বয়ামের মোট ভরের কী হবে?" }, [
    { id: "a", text: { en: "It stays the same, atoms are only rearranged", bn: "একই থাকবে, পরমাণু শুধু নতুনভাবে সাজে" }, correct: true },
    { id: "b", text: { en: "It increases, light adds mass", bn: "বাড়বে, আলো ভর যোগ করে" }, misconception: "light-is-food" },
    { id: "c", text: { en: "It decreases, the plant uses up the soil", bn: "কমবে, গাছ মাটি খেয়ে ফেলে" }, misconception: "mass-from-soil" },
  ], { en: "Nothing enters or leaves a sealed jar except light, which carries no atoms. Mass is conserved.", bn: "বন্ধ বয়ামে আলো ছাড়া কিছু ঢোকে বা বের হয় না, আর আলোতে পরমাণু নেই। ভর সংরক্ষিত থাকে।" }, "reverse"),
];

const EXAM: Question[] = [
  q("tree.e1", "exam", { en: "Which gas do plants release during photosynthesis?", bn: "সালোকসংশ্লেষণে উদ্ভিদ কোন গ্যাস ত্যাগ করে?" }, [
    { id: "a", text: { en: "Oxygen", bn: "অক্সিজেন" }, correct: true },
    { id: "b", text: { en: "Carbon dioxide", bn: "কার্বন ডাই-অক্সাইড" } },
    { id: "c", text: { en: "Nitrogen", bn: "নাইট্রোজেন" } },
  ], { en: "Oxygen is released; CO₂ is taken in.", bn: "অক্সিজেন বের হয়; CO₂ গ্রহণ করা হয়।" }),
  q("tree.e2", "exam", { en: "Where in a leaf cell does photosynthesis mainly happen?", bn: "পাতার কোষের কোথায় প্রধানত সালোকসংশ্লেষণ ঘটে?" }, [
    { id: "a", text: { en: "Chloroplast", bn: "ক্লোরোপ্লাস্ট" }, correct: true },
    { id: "b", text: { en: "Nucleus", bn: "নিউক্লিয়াস" } },
    { id: "c", text: { en: "Mitochondria", bn: "মাইটোকন্ড্রিয়া" } },
    { id: "d", text: { en: "Cell wall", bn: "কোষপ্রাচীর" } },
  ], { en: "Chloroplasts contain chlorophyll, which captures light.", bn: "ক্লোরোপ্লাস্টে ক্লোরোফিল থাকে, যা আলো ধরে।" }),
  q("tree.e3", "exam", { en: "What is the main role of sunlight in photosynthesis?", bn: "সালোকসংশ্লেষণে সূর্যালোকের প্রধান ভূমিকা কী?" }, [
    { id: "a", text: { en: "It provides energy", bn: "শক্তি জোগায়" }, correct: true },
    { id: "b", text: { en: "It provides carbon", bn: "কার্বন জোগায়" }, misconception: "light-is-food" },
    { id: "c", text: { en: "It provides minerals", bn: "খনিজ জোগায়" } },
  ], { en: "Light drives the reaction; it is not an ingredient.", bn: "আলো বিক্রিয়া চালায়; এটি উপাদান নয়।" }),
];

export const TREE: LessonPack = {
  concept: "tree",
  rumiOpening: { en: "Plants eat soil, right? That's why we put them in pots of soil.", bn: "গাছ তো মাটি খায়, তাই না? সেজন্যই তো টবে মাটি দিই।" },
  ideas: IDEAS,
  misconceptions: MISC,
  probe: PROBE,
  trials: TRIALS,
  exam: EXAM,
};
