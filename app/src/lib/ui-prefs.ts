// Per-device reading preferences. Stored in localStorage only; never sent anywhere.
export type UiPrefs = { text: "normal" | "large" | "larger"; motion: "system" | "reduce" };
const KEY = "edu_ui_v1";
export function readUi(): UiPrefs {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<UiPrefs>;
    return {
      text: v.text === "large" || v.text === "larger" ? v.text : "normal",
      motion: v.motion === "reduce" ? "reduce" : "system",
    };
  } catch {
    return { text: "normal", motion: "system" };
  }
}
export function applyUi(p: UiPrefs) {
  const el = document.documentElement;
  if (p.text === "normal") el.removeAttribute("data-text");
  else el.setAttribute("data-text", p.text);
  if (p.motion === "reduce") el.setAttribute("data-motion", "reduce");
  else el.removeAttribute("data-motion");
}
export function writeUi(p: UiPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: applies for this visit only */
  }
  applyUi(p);
}
