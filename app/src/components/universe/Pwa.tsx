// Registers the service worker, offers updates when a new version is waiting, and offers installation
// when the browser supports it. Nothing here touches learning data.
import { useEffect, useState } from "react";

import { useLearner } from "../../lib/store";
import { Icon } from "./icons";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const DISMISS = "edu_install_dismissed_v1";

export function PwaManager() {
  const { tx, account } = useLearner();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !(
        location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
      )
    )
      return;
    let reloading = false;
    // Reload only when the student asked for the update; the first install must never reload the page.
    const onChange = () => {
      if (!reloading && (window as { __eduUpdating?: boolean }).__eduUpdating) {
        reloading = true;
        location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        const hadController = !!navigator.serviceWorker.controller;
        if (reg.waiting && hadController) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) setWaiting(w);
          });
        });
        // Check for a new version when the student comes back to the tab.
        const check = () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
        };
        document.addEventListener("visibilitychange", check);
      })
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      try {
        if (window.localStorage.getItem(DISMISS)) return;
      } catch {
        /* ignore */
      }
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (waiting) {
    return (
      <div
        role="status"
        className="edu-pop fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[18px] bg-ink p-3 pl-4 text-white shadow-[var(--shadow-lift)] lg:bottom-6"
      >
        <Icon name="download" className="shrink-0" />
        <span className="flex-1 text-[15px]">
          {tx("A new version of IntelliHorizon is ready.", "ইন্টেলিহরাইজনের নতুন সংস্করণ প্রস্তুত।")}
        </span>
        <button
          type="button"
          onClick={() => {
            (window as { __eduUpdating?: boolean }).__eduUpdating = true;
            waiting.postMessage("SKIP_WAITING");
          }}
          className="h-10 rounded-[12px] bg-white px-4 text-[15px] font-semibold text-ink"
        >
          {tx("Update", "হালনাগাদ")}
        </button>
      </div>
    );
  }
  if (install && account) {
    return (
      <div
        role="dialog"
        aria-label={tx("Install IntelliHorizon", "ইন্টেলিহরাইজন ইনস্টল করো")}
        className="edu-pop fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[18px] border border-line bg-sheet p-3 pl-4 shadow-[var(--shadow-lift)] lg:bottom-6"
      >
        <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-[10px]" />
        <span className="flex-1 text-[15px]">
          {tx(
            "Add IntelliHorizon to your home screen for quicker access.",
            "দ্রুত খুলতে ইন্টেলিহরাইজন হোম স্ক্রিনে যোগ করো।",
          )}
        </span>
        <button
          type="button"
          onClick={async () => {
            await install.prompt();
            setInstall(null);
          }}
          className="h-10 rounded-[12px] bg-brand px-4 text-[15px] font-semibold text-white"
        >
          {tx("Install", "ইনস্টল")}
        </button>
        <button
          type="button"
          aria-label={tx("Not now", "এখন না")}
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS, "1");
            } catch {
              /* ignore */
            }
            setInstall(null);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] text-ink-mid hover:bg-lilac"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    );
  }
  return null;
}
