import type { L } from "../../content/types";

const M: Record<string, L> = {
  name_required: { en: "Enter the name you'd like to be called.", bn: "যে নামে ডাকা হোক চাও, সেটি লেখো।" },
  name_too_long: { en: "That name is longer than 80 characters.", bn: "নামটি ৮০ অক্ষরের বেশি।" },
  name_invalid: { en: "Use letters, spaces, hyphens or apostrophes.", bn: "অক্ষর, স্পেস, হাইফেন বা অ্যাপোস্ট্রফি ব্যবহার করো।" },
  username_required: { en: "Choose a username.", bn: "একটি ইউজারনেম বেছে নাও।" },
  username_too_short: { en: "At least 3 characters.", bn: "কমপক্ষে ৩টি অক্ষর।" },
  username_too_long: { en: "At most 20 characters.", bn: "সর্বোচ্চ ২০টি অক্ষর।" },
  username_format: { en: "Start with a letter. Use a to z, 0 to 9, dots or underscores.", bn: "অক্ষর দিয়ে শুরু করো। a থেকে z, ০ থেকে ৯, ডট বা আন্ডারস্কোর ব্যবহার করো।" },
  username_reserved: { en: "That username is reserved. Try another.", bn: "এই ইউজারনেমটি সংরক্ষিত। অন্যটি চেষ্টা করো।" },
  username_inappropriate: { en: "Please choose a different username.", bn: "অনুগ্রহ করে অন্য ইউজারনেম বেছে নাও।" },
  username_taken: { en: "That username is taken.", bn: "এই ইউজারনেমটি আগেই নেওয়া হয়েছে।" },
  email_required: { en: "Enter your email address.", bn: "তোমার ইমেইল ঠিকানা লেখো।" },
  email_invalid: { en: "That doesn't look like an email address.", bn: "এটি সঠিক ইমেইল ঠিকানা মনে হচ্ছে না।" },
  email_unavailable: { en: "This email can't be used for a new account. If it's yours, sign in or reset your password.", bn: "এই ইমেইল দিয়ে নতুন অ্যাকাউন্ট খোলা যাবে না। এটি তোমার হলে সাইন ইন করো বা পাসওয়ার্ড রিসেট করো।" },
  email_same: { en: "That's already your email.", bn: "এটাই তো তোমার ইমেইল।" },
  password_required: { en: "Create a password.", bn: "একটি পাসওয়ার্ড দাও।" },
  password_too_short: { en: "Use at least 8 characters.", bn: "কমপক্ষে ৮টি অক্ষর দাও।" },
  password_too_long: { en: "Use 128 characters or fewer.", bn: "১২৮টি অক্ষরের মধ্যে রাখো।" },
  password_common: { en: "That password is too common. Try a short phrase only you would know.", bn: "পাসওয়ার্ডটি খুব প্রচলিত। শুধু তুমি জানো এমন ছোট বাক্য চেষ্টা করো।" },
  password_personal: { en: "Don't include your username or email in your password.", bn: "পাসওয়ার্ডে ইউজারনেম বা ইমেইল রেখো না।" },
  password_breached: { en: "This password has appeared in a data leak elsewhere. Please choose another.", bn: "এই পাসওয়ার্ডটি অন্য কোথাও তথ্য ফাঁসে দেখা গেছে। অন্য একটি বেছে নাও।" },
  password_mismatch: { en: "The passwords don't match.", bn: "পাসওয়ার্ড দুটি মিলছে না।" },
  current_wrong: { en: "That password isn't right.", bn: "পাসওয়ার্ডটি সঠিক নয়।" },
  school_too_long: { en: "Keep the school name under 120 characters.", bn: "স্কুলের নাম ১২০ অক্ষরের মধ্যে রাখো।" },
  school_invalid: { en: "Please check the school name.", bn: "স্কুলের নামটি দেখে নাও।" },
  country_invalid: { en: "Choose a country option.", bn: "একটি দেশ বেছে নাও।" },
  district_required: { en: "Choose your district from the list.", bn: "তালিকা থেকে তোমার জেলা বেছে নাও।" },
  district_invalid: { en: "Pick a district from the list.", bn: "তালিকা থেকে একটি জেলা বেছে নাও।" },
  region_invalid: { en: "Keep this under 80 characters.", bn: "৮০ অক্ষরের মধ্যে রাখো।" },
  grade_required: { en: "Choose your class.", bn: "তোমার শ্রেণি বেছে নাও।" },
  grade_invalid: { en: "Choose a class from the options.", bn: "অপশন থেকে শ্রেণি বেছে নাও।" },
  curriculum_required: { en: "Choose your curriculum.", bn: "তোমার পাঠ্যক্রম বেছে নাও।" },
  curriculum_invalid: { en: "Choose a curriculum from the options.", bn: "অপশন থেকে পাঠ্যক্রম বেছে নাও।" },
  curriculum_other_required: { en: "Tell us which curriculum.", bn: "কোন পাঠ্যক্রম তা জানাও।" },
  curriculum_text_required: { en: "Type the curriculum name.", bn: "পাঠ্যক্রমের নাম লেখো।" },
  curriculum_text_invalid: { en: "Keep this under 60 characters.", bn: "৬০ অক্ষরের মধ্যে রাখো।" },
  avatar_invalid: { en: "Choose one of the illustrations.", bn: "একটি ছবি বেছে নাও।" },
  privacy_required: { en: "Please confirm you've read how we look after your information.", bn: "তোমার তথ্য কীভাবে রাখা হয় তা পড়েছ বলে নিশ্চিত করো।" },
  invalid_credentials: { en: "That email or username and password don't match.", bn: "ইমেইল বা ইউজারনেম আর পাসওয়ার্ড মিলছে না।" },
  rate_limited: { en: "Too many attempts. Please wait a few minutes and try again.", bn: "অনেকবার চেষ্টা হয়েছে। কয়েক মিনিট অপেক্ষা করে আবার চেষ্টা করো।" },
  unavailable_now: { en: "Accounts are unavailable right now. Please try again shortly.", bn: "এই মুহূর্তে অ্যাকাউন্ট সেবা চালু নেই। একটু পরে চেষ্টা করো।" },
  bad_origin: { en: "This request was blocked for your safety. Reload the page and try again.", bn: "তোমার নিরাপত্তার জন্য অনুরোধটি আটকানো হয়েছে। পেজ রিলোড করে আবার চেষ্টা করো।" },
  save_failed: { en: "We couldn't save that. Nothing was changed. Please try again.", bn: "সংরক্ষণ করা যায়নি। কিছু বদলায়নি। আবার চেষ্টা করো।" },
  created_signin_failed: { en: "Your account was created, but we couldn't sign you in. Please sign in.", bn: "অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু সাইন ইন করানো যায়নি। অনুগ্রহ করে সাইন ইন করো।" },
  retry_conflict: { en: "This form was already used. Reload the page to start again.", bn: "এই ফর্মটি আগেই ব্যবহার হয়েছে। নতুন করে শুরু করতে পেজ রিলোড করো।" },
  network: { en: "You seem to be offline. Your details are still here: try again when you're connected.", bn: "তুমি সম্ভবত অফলাইনে। তোমার তথ্য এখানেই আছে: সংযোগ পেলে আবার চেষ্টা করো।" },
  timeout: { en: "That took too long. Your details are still here: please try again.", bn: "অনেক সময় লেগেছে। তোমার তথ্য এখানেই আছে: আবার চেষ্টা করো।" },
  signed_out: { en: "Your session has ended. Please sign in again.", bn: "তোমার সেশন শেষ হয়েছে। আবার সাইন ইন করো।" },
  token_invalid: { en: "This link isn't valid. It may have been copied incorrectly.", bn: "লিংকটি সঠিক নয়। হয়তো ভুলভাবে কপি হয়েছে।" },
  token_expired: { en: "This link has expired. You can ask for a new one.", bn: "লিংকটির মেয়াদ শেষ। নতুন লিংক চাইতে পারো।" },
  token_used: { en: "This link has already been used.", bn: "এই লিংকটি আগেই ব্যবহার হয়েছে।" },
  email_not_configured: { en: "Email sending isn't set up on IntelliHorizon yet, so this can't be done right now.", bn: "ইন্টেলিহরাইজনে এখনো ইমেইল পাঠানোর ব্যবস্থা চালু হয়নি, তাই এখন এটি করা যাচ্ছে না।" },
  image_too_large: { en: "That image is too large. Choose one under 10 MB.", bn: "ছবিটি অনেক বড়। ১০ এমবির কম একটি বেছে নাও।" },
  image_type: { en: "Use a JPEG, PNG or WebP image.", bn: "JPEG, PNG বা WebP ছবি ব্যবহার করো।" },
  image_invalid: { en: "We couldn't read that image.", bn: "ছবিটি পড়া যায়নি।" },
  image_unreadable: { en: "We couldn't open that image. Try a different photo.", bn: "ছবিটি খোলা যায়নি। অন্য একটি ছবি চেষ্টা করো।" },
  upload_failed: { en: "The photo didn't upload. Please try again.", bn: "ছবি আপলোড হয়নি। আবার চেষ্টা করো।" },
  storage_unavailable: { en: "Photo storage isn't available right now. You can add a photo later.", bn: "এখন ছবি রাখার ব্যবস্থা চালু নেই। পরে ছবি যোগ করতে পারো।" },
  unreadable: { en: "That answer couldn't be read. Check it and try again.", bn: "উত্তরটি পড়া যায়নি। দেখে আবার চেষ্টা করো।" },
  unreadable_number: { en: "That couldn't be read as a number. Write it like 3, 9.6, 48/5 or 9 3/5 (for ratios: 3 : 6 : 10).", bn: "সংখ্যা হিসেবে পড়া যায়নি। এভাবে লেখো: ৩, ৯.৬, ৪৮/৫ বা ৯ ৩/৫ (অনুপাত: ৩ : ৬ : ১০)।" },
  empty_answer: { en: "Write an answer first.", bn: "আগে একটি উত্তর লেখো।" },
  not_in_session: { en: "That question isn't part of this session.", bn: "প্রশ্নটি এই সেশনের অংশ নয়।" },
  too_short: { en: "Write a little more: a sentence or two in your own words.", bn: "আরেকটু লেখো: নিজের ভাষায় এক-দুই বাক্য।" },
  no_key_ideas: { en: "Explain It Back isn't available for this chapter yet.", bn: "এই অধ্যায়ে এখনো 'নিজের ভাষায় বলো' নেই।" },
  checks_failed: { en: "This question doesn't pass its checks yet.", bn: "প্রশ্নটি এখনো যাচাইয়ে উত্তীর্ণ হয়নি।" },
  review_first: { en: "Mark it reviewed before publishing.", bn: "প্রকাশের আগে পর্যালোচিত চিহ্নিত করো।" },
  not_a_draft: { en: "Only drafts can be marked reviewed.", bn: "শুধু খসড়াই পর্যালোচিত চিহ্নিত করা যায়।" },
  not_published: { en: "This question isn't published.", bn: "প্রশ্নটি প্রকাশিত নয়।" },
  unknown: { en: "Something went wrong on our side. Please try again.", bn: "আমাদের দিকে কিছু সমস্যা হয়েছে। আবার চেষ্টা করো।" },
  context_invalid: { en: "That book or chapter isn't available. Choose again from the list.", bn: "এই বই বা অধ্যায়টি পাওয়া যাচ্ছে না। তালিকা থেকে আবার বাছো।" },
  subject_mismatch: { en: "That book belongs to a different subject. Choose the subject first, then one of its books.", bn: "বইটি অন্য বিষয়ের। আগে বিষয়, তারপর সেই বিষয়ের একটি বই বাছো।" },
  subject_invalid: { en: "IntelliHorizon covers eight subjects; that isn't one of them.", bn: "ইন্টেলিহরাইজন আটটি বিষয় কভার করে; এটি তাদের একটি নয়।" },
  context_outside_profile: { en: "That book isn't for your class and version.", bn: "বইটি তোমার শ্রেণি ও ভার্সনের নয়।" },
};

export function msg(code: string | undefined | null): L | null {
  if (!code) return null;
  return M[code] ?? M.unknown;
}

/** Call a server function with a timeout, mapping transport failures to codes instead of throwing. */
export async function call<T>(p: Promise<T>, ms = 20000): Promise<T | { ok: false; code: string; fields?: Record<string, string> }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } catch (e) {
    const m = (e as Error)?.message ?? "";
    if (m === "timeout") return { ok: false, code: "timeout" };
    if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, code: "network" };
    if (/fetch|network/i.test(m)) return { ok: false, code: "network" };
    return { ok: false, code: "unknown" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
