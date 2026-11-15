import { describe, expect, test } from "bun:test";

import { dummyVerify, hashPassword, sha256Hex, timingSafeEqual, verifyPassword } from "../src/lib/auth/crypto.server";
import { normalizeEmail, normalizeUsername, passwordStrength, safeNext, validateEmail, validateName, validatePassword, validateProfile, validateUsername } from "../src/lib/auth/validation";
import { BD_DISTRICTS } from "../src/content/districts";

describe("names", () => {
  test("accepts Bangla and English names, rejects empty and junk", () => {
    expect(validateName("Nusrat Jahan")).toBeNull();
    expect(validateName("নুসরাত জাহান")).toBeNull();
    expect(validateName("  রফিক-উল ইসলাম  ")).toBeNull();
    expect(validateName("O'Brien")).toBeNull();
    expect(validateName("   ")).toBe("name_required");
    expect(validateName("a".repeat(81))).toBe("name_too_long");
    expect(validateName("<script>")).toBe("name_invalid");
    expect(validateName("Ana\u0000")).toBe("name_invalid");
  });
});

describe("usernames", () => {
  test("normalises and validates", () => {
    expect(normalizeUsername("  Rafi_10 ")).toBe("rafi_10");
    expect(validateUsername("rafi_10")).toBeNull();
    expect(validateUsername("ra")).toBe("username_too_short");
    expect(validateUsername("1rafi")).toBe("username_format");
    expect(validateUsername("rafi..x")).toBe("username_format");
    expect(validateUsername("rafi.")).toBe("username_format");
    expect(validateUsername("admin")).toBe("username_reserved");
    expect(validateUsername("a".repeat(21))).toBe("username_too_long");
    const rot = (w: string) => w.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
    expect(validateUsername(rot("kshpxk"))).toBe("username_inappropriate");
  });
});

describe("email and password", () => {
  test("email", () => {
    expect(normalizeEmail(" Student@Example.COM ")).toBe("student@example.com");
    expect(validateEmail("student@example.com")).toBeNull();
    expect(validateEmail("student@")).toBe("email_invalid");
  });
  test("password rules", () => {
    expect(validatePassword("short")).toBe("password_too_short");
    expect(validatePassword("password123")).toBe("password_common");
    expect(validatePassword("rafi_10 likes mangoes", { username: "rafi_10" })).toBe("password_personal");
    expect(validatePassword("monsoon river kite 7")).toBeNull();
    expect(validatePassword("x".repeat(129))).toBe("password_too_long");
    expect(passwordStrength("monsoon river kite 7")).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("12345678")).toBe(0);
  });
});

describe("profile", () => {
  const ok = { school: "", country: "BD" as const, district: "rajshahi", region: "", grade: 8, curriculum: "nctb-bangla", curriculumOther: "", curriculumOtherText: "" };
  test("valid and invalid selections", () => {
    expect(validateProfile(ok)).toEqual({});
    expect(validateProfile({ ...ok, district: "atlantis" }).district).toBe("district_invalid");
    expect(validateProfile({ ...ok, grade: 11 }).grade).toBe("grade_invalid");
    expect(validateProfile({ ...ok, curriculum: "v2.1" }).curriculum).toBe("curriculum_invalid");
    expect(validateProfile({ ...ok, curriculum: "other" }).curriculumOther).toBe("curriculum_other_required");
    expect(validateProfile({ ...ok, curriculum: "other", curriculumOther: "other" }).curriculumOtherText).toBe("curriculum_text_required");
    expect(validateProfile({ ...ok, country: "OTHER", district: "" })).toEqual({});
  });
  test("64 unique districts", () => {
    expect(BD_DISTRICTS.length).toBe(64);
    expect(new Set(BD_DISTRICTS.map((d) => d.code)).size).toBe(64);
  });
});

describe("crypto", () => {
  test("hash and verify", async () => {
    const h = await hashPassword("monsoon river kite 7");
    expect(h.startsWith("pbkdf2-sha256$100000$")).toBe(true);
    expect(h.includes("monsoon")).toBe(false);
    expect(await verifyPassword("monsoon river kite 7", h)).toBe(true);
    expect(await verifyPassword("monsoon river kite 8", h)).toBe(false);
    const h2 = await hashPassword("monsoon river kite 7");
    expect(h2).not.toBe(h); // unique salt
    expect(await verifyPassword("x", "garbage")).toBe(false);
    await dummyVerify("anything");
  });
  test("helpers", async () => {
    expect((await sha256Hex("abc")).length).toBe(64);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });
  test("safe redirect", () => {
    expect(safeNext("/account")).toBe("/account");
    // Anything unsafe falls back to the student's dashboard.
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("/signin")).toBe("/dashboard");
    expect(safeNext("/login?next=/x")).toBe("/dashboard");
    expect(safeNext(undefined)).toBe("/dashboard");
  });
});
