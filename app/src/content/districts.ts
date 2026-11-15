// The 64 districts of Bangladesh, grouped by division. Codes are stable ASCII slugs stored in profiles.
export type District = { code: string; en: string; bn: string; division: string };

const D = (division: string, rows: [string, string, string][]): District[] => rows.map(([code, en, bn]) => ({ code, en, bn, division }));

export const BD_DISTRICTS: District[] = [
  ...D("Dhaka", [["dhaka", "Dhaka", "ঢাকা"], ["faridpur", "Faridpur", "ফরিদপুর"], ["gazipur", "Gazipur", "গাজীপুর"], ["gopalganj", "Gopalganj", "গোপালগঞ্জ"], ["kishoreganj", "Kishoreganj", "কিশোরগঞ্জ"], ["madaripur", "Madaripur", "মাদারীপুর"], ["manikganj", "Manikganj", "মানিকগঞ্জ"], ["munshiganj", "Munshiganj", "মুন্সীগঞ্জ"], ["narayanganj", "Narayanganj", "নারায়ণগঞ্জ"], ["narsingdi", "Narsingdi", "নরসিংদী"], ["rajbari", "Rajbari", "রাজবাড়ী"], ["shariatpur", "Shariatpur", "শরীয়তপুর"], ["tangail", "Tangail", "টাঙ্গাইল"]]),
  ...D("Chattogram", [["bandarban", "Bandarban", "বান্দরবান"], ["brahmanbaria", "Brahmanbaria", "ব্রাহ্মণবাড়িয়া"], ["chandpur", "Chandpur", "চাঁদপুর"], ["chattogram", "Chattogram", "চট্টগ্রাম"], ["cumilla", "Cumilla", "কুমিল্লা"], ["coxsbazar", "Cox's Bazar", "কক্সবাজার"], ["feni", "Feni", "ফেনী"], ["khagrachhari", "Khagrachhari", "খাগড়াছড়ি"], ["lakshmipur", "Lakshmipur", "লক্ষ্মীপুর"], ["noakhali", "Noakhali", "নোয়াখালী"], ["rangamati", "Rangamati", "রাঙ্গামাটি"]]),
  ...D("Rajshahi", [["bogura", "Bogura", "বগুড়া"], ["chapainawabganj", "Chapainawabganj", "চাঁপাইনবাবগঞ্জ"], ["joypurhat", "Joypurhat", "জয়পুরহাট"], ["naogaon", "Naogaon", "নওগাঁ"], ["natore", "Natore", "নাটোর"], ["pabna", "Pabna", "পাবনা"], ["rajshahi", "Rajshahi", "রাজশাহী"], ["sirajganj", "Sirajganj", "সিরাজগঞ্জ"]]),
  ...D("Khulna", [["bagerhat", "Bagerhat", "বাগেরহাট"], ["chuadanga", "Chuadanga", "চুয়াডাঙ্গা"], ["jashore", "Jashore", "যশোর"], ["jhenaidah", "Jhenaidah", "ঝিনাইদহ"], ["khulna", "Khulna", "খুলনা"], ["kushtia", "Kushtia", "কুষ্টিয়া"], ["magura", "Magura", "মাগুরা"], ["meherpur", "Meherpur", "মেহেরপুর"], ["narail", "Narail", "নড়াইল"], ["satkhira", "Satkhira", "সাতক্ষীরা"]]),
  ...D("Barishal", [["barguna", "Barguna", "বরগুনা"], ["barishal", "Barishal", "বরিশাল"], ["bhola", "Bhola", "ভোলা"], ["jhalokati", "Jhalokati", "ঝালকাঠি"], ["patuakhali", "Patuakhali", "পটুয়াখালী"], ["pirojpur", "Pirojpur", "পিরোজপুর"]]),
  ...D("Sylhet", [["habiganj", "Habiganj", "হবিগঞ্জ"], ["moulvibazar", "Moulvibazar", "মৌলভীবাজার"], ["sunamganj", "Sunamganj", "সুনামগঞ্জ"], ["sylhet", "Sylhet", "সিলেট"]]),
  ...D("Rangpur", [["dinajpur", "Dinajpur", "দিনাজপুর"], ["gaibandha", "Gaibandha", "গাইবান্ধা"], ["kurigram", "Kurigram", "কুড়িগ্রাম"], ["lalmonirhat", "Lalmonirhat", "লালমনিরহাট"], ["nilphamari", "Nilphamari", "নীলফামারী"], ["panchagarh", "Panchagarh", "পঞ্চগড়"], ["rangpur", "Rangpur", "রংপুর"], ["thakurgaon", "Thakurgaon", "ঠাকুরগাঁও"]]),
  ...D("Mymensingh", [["jamalpur", "Jamalpur", "জামালপুর"], ["mymensingh", "Mymensingh", "ময়মনসিংহ"], ["netrokona", "Netrokona", "নেত্রকোণা"], ["sherpur", "Sherpur", "শেরপুর"]]),
];

export const districtByCode = (code: string | null | undefined) => BD_DISTRICTS.find((d) => d.code === code);
