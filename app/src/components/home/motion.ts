// Motion for the homepage: scroll reveals, scroll-linked parallax and pointer depth. All of it is progressive: content
// renders fully without JavaScript, and nothing moves when the visitor prefers reduced motion (system setting or the
// in-app Settings switch). Only transform and opacity change, written once per animation frame.
import { type RefObject, useEffect, useState } from "react";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
}

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(prefersReducedMotion());
    update();
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => { mq.removeEventListener("change", update); obs.disconnect(); };
  }, []);
  return reduce;
}

/** Adds .ih-motion to the root and reveals .ih-reveal children as they enter the viewport. */
export function useReveal(root: RefObject<HTMLElement | null>, reduce: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!el || reduce || typeof IntersectionObserver === "undefined") { el?.classList.remove("ih-motion"); return; }
    const items = [...el.querySelectorAll<HTMLElement>(".ih-reveal")];
    // Anything already on screen is shown at once, so turning motion on never hides visible text.
    for (const it of items) if (it.getBoundingClientRect().top < window.innerHeight * 0.92) it.dataset.shown = "true";
    el.classList.add("ih-motion");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.shown = "true"; io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    for (const it of items) if (it.dataset.shown !== "true") io.observe(it);
    return () => { io.disconnect(); el.classList.remove("ih-motion"); };
  }, [root, reduce]);
}

/**
 * Hero depth: --ih-scroll (0 at the top, 1 when the hero has scrolled away) and --ih-px / --ih-py (pointer position,
 * -1..1, fine pointers only). Passive listeners; one write per frame; nothing on touch-only devices.
 */
export function useHeroDepth(hero: RefObject<HTMLElement | null>, reduce: boolean) {
  useEffect(() => {
    const el = hero.current;
    if (!el || reduce) { el?.style.removeProperty("--ih-scroll"); el?.style.removeProperty("--ih-px"); el?.style.removeProperty("--ih-py"); return; }
    let frame = 0;
    let px = 0, py = 0;
    const write = () => {
      frame = 0;
      const h = el.offsetHeight || 1;
      const s = Math.min(Math.max(window.scrollY / h, 0), 1);
      el.style.setProperty("--ih-scroll", s.toFixed(4));
      el.style.setProperty("--ih-px", px.toFixed(3));
      el.style.setProperty("--ih-py", py.toFixed(3));
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(write); };
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 2 - 1;
      py = ((e.clientY - r.top) / r.height) * 2 - 1;
      queue();
    };
    window.addEventListener("scroll", queue, { passive: true });
    if (fine) el.addEventListener("pointermove", onMove, { passive: true });
    write();
    return () => { window.removeEventListener("scroll", queue); el.removeEventListener("pointermove", onMove); if (frame) cancelAnimationFrame(frame); };
  }, [hero, reduce]);
}

/** Which of a list of elements is closest to the middle of the viewport (for the learning-cycle storytelling). */
export function useActiveIndex(refs: RefObject<(HTMLElement | null)[]>, count: number): number {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = (refs.current ?? []).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index ?? 0));
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    els.forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [refs, count]);
  return active;
}
