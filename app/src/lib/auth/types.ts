export type AvatarRef = { type: "upload"; v: string } | { type: "preset"; id: string } | null;

export type AccountSummary = {
  fullName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  avatar: AvatarRef;
  school: string;
  country: "BD" | "OTHER";
  district: string;
  region: string;
  grade: number;
  curriculum: string;
  curriculumOther: string;
  curriculumOtherText: string;
  createdAt: string;
  emailDelivery: boolean;
  explainLang: "en" | "bn" | null;
  goals: string[];
  role: "student" | "admin";
  /** An isolated judge-demo workspace (expires; cannot change credentials or become admin). */
  demo: { expiresAt: string } | null;
};
