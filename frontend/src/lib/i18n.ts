export type Lang = "en" | "bn";
export const LANG_COOKIE = "lang";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "bn";

/** Interface strings. Portfolio *content* (projects, papers, notes…) is shown as written in the admin. */
const D = {
  "nav.about": { en: "About", bn: "পরিচিতি" },
  "nav.research": { en: "Research", bn: "গবেষণা" },
  "nav.projects": { en: "Projects", bn: "প্রজেক্ট" },
  "nav.notes": { en: "Notes", bn: "নোটস" },
  "nav.experience": { en: "Experience", bn: "অভিজ্ঞতা" },
  "nav.contact": { en: "Contact", bn: "যোগাযোগ" },
  "hero.available": { en: "Available for new work", bn: "নতুন কাজের জন্য প্রস্তুত" },
  "hero.projects": { en: "View my projects", bn: "আমার প্রজেক্ট দেখুন" },
  "hero.cv": { en: "Download CV", bn: "সিভি ডাউনলোড" },
  "hero.contact": { en: "Contact me", bn: "যোগাযোগ করুন" },
  "sec.research": { en: "Research & publications", bn: "গবেষণা ও প্রকাশনা" },
  "sec.research.lede": { en: "Peer-reviewed work, with links to the published versions.", bn: "পিয়ার-রিভিউড কাজ, প্রকাশিত সংস্করণের লিংকসহ।" },
  "sec.research.more": { en: "Open the research page", bn: "গবেষণা পাতা দেখুন" },
  "sec.projects": { en: "Selected projects", bn: "নির্বাচিত প্রজেক্ট" },
  "sec.projects.lede": { en: "Systems I've designed and built, from research prototypes to full-stack products.", bn: "গবেষণা প্রোটোটাইপ থেকে ফুল-স্ট্যাক প্রোডাক্ট পর্যন্ত — আমার ডিজাইন ও তৈরি করা সিস্টেম।" },
  "sec.projects.all": { en: "Browse all {n} projects", bn: "সব {n}টি প্রজেক্ট দেখুন" },
  "sec.skills": { en: "Skills", bn: "দক্ষতা" },
  "sec.skills.lede": { en: "The tools and methods I work with, grouped by area.", bn: "যেসব টুল ও পদ্ধতিতে কাজ করি, বিষয় অনুযায়ী সাজানো।" },
  "sec.experience": { en: "Experience & leadership", bn: "অভিজ্ঞতা ও নেতৃত্ব" },
  "sec.education": { en: "Education", bn: "শিক্ষা" },
  "sec.achievements": { en: "Achievements", bn: "অর্জন" },
  "sec.testimonials": { en: "What others say", bn: "অন্যরা যা বলেন" },
  "sec.testimonials.lede": { en: "Words from supervisors and teammates.", bn: "সুপারভাইজার ও সহকর্মীদের কথা।" },
  "sec.notes": { en: "Notes", bn: "নোটস" },
  "sec.notes.lede": { en: "Short technical write-ups — how I built things and what I learned.", bn: "ছোট ছোট টেকনিক্যাল লেখা — কীভাবে তৈরি করেছি, কী শিখেছি।" },
  "sec.notes.all": { en: "Read all notes", bn: "সব নোট পড়ুন" },
  "contact.title": { en: "Get in touch", bn: "যোগাযোগ করুন" },
  "contact.default": { en: "Have a role, a research idea or a project in mind? Send a message and I'll reply by email.", bn: "কোনো কাজ, গবেষণার আইডিয়া বা প্রজেক্ট নিয়ে কথা বলতে চান? মেসেজ পাঠান, আমি ইমেইলে উত্তর দেব।" },
  "contact.name": { en: "Name", bn: "নাম" },
  "contact.email": { en: "Email", bn: "ইমেইল" },
  "contact.subject": { en: "Subject", bn: "বিষয়" },
  "contact.message": { en: "Message", bn: "বার্তা" },
  "contact.privacy": { en: "Your details are only used to reply to you.", bn: "আপনার তথ্য শুধু উত্তর দেওয়ার জন্য ব্যবহার করা হবে।" },
  "contact.send": { en: "Send message", bn: "বার্তা পাঠান" },
  "contact.sending": { en: "Sending", bn: "পাঠানো হচ্ছে" },
  "contact.sent": { en: "Message sent", bn: "বার্তা পাঠানো হয়েছে" },
  "contact.sent.body": { en: "Thanks for writing. I'll reply to the email address you gave.", bn: "লেখার জন্য ধন্যবাদ। আপনার দেওয়া ইমেইলে উত্তর দেব।" },
  "projects.title": { en: "Projects", bn: "প্রজেক্ট" },
  "projects.lede": { en: "Everything I've documented, newest first. Filter by area or technology, or search for something specific.", bn: "আমার ডকুমেন্ট করা সব প্রজেক্ট, নতুনগুলো আগে। বিষয় বা টেকনোলজি দিয়ে ফিল্টার করুন, অথবা সার্চ করুন।" },
  "notes.title": { en: "Notes", bn: "নোটস" },
  "notes.lede": { en: "Short technical write-ups: how things were built, what worked, what didn't.", bn: "ছোট টেকনিক্যাল লেখা: কীভাবে তৈরি হলো, কী কাজ করল, কী করল না।" },
  "notes.min": { en: "{n} min read", bn: "{n} মিনিটের পাঠ" },
  "notes.back": { en: "All notes", bn: "সব নোট" },
  "notes.empty": { en: "No notes yet — check back soon.", bn: "এখনো কোনো নোট নেই — শীঘ্রই আসছে।" },
  "notes.all.tags": { en: "All", bn: "সব" },
  "cv.print": { en: "Print / Save as PDF", bn: "প্রিন্ট / পিডিএফ সেভ" },
  "lang.switch": { en: "বাংলা", bn: "English" },
} as const;

export type I18nKey = keyof typeof D;

export function translate(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  let s: string = D[key][lang] ?? D[key].en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
