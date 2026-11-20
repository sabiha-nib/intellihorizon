import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import appMetaJson from "../app-meta.json";
import { reportHiggsfieldError } from "../lib/higgsfield-error-reporting";
import { getLearnerState } from "../lib/api/learner.functions";
import { LearnerProvider } from "../lib/store";
import { applyUi, readUi } from "../lib/ui-prefs";
import { PwaManager } from "../components/universe/Pwa";

declare const __HF_DESIGN_INSPECTOR__: boolean;

type AppMeta = {
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  favicon_url?: string | null;
  og_video_url?: string | null;
};
const appMeta = appMetaJson as AppMeta;
const APP_HOST_ZONES = ["higgsfield.app", "higgsfield-dev.app"];

function toOwnAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const u = new URL(value);
    if (APP_HOST_ZONES.some((z) => u.hostname === z || u.hostname.endsWith(`.${z}`))) return u.pathname + u.search;
    return value;
  } catch {
    return value;
  }
}

function buildHead(meta: AppMeta) {
  const title = meta.og_title ?? "IntelliHorizon";
  const description = meta.og_description ?? "IntelliHorizon: an AI-powered personalised learning ecosystem for NCTB Classes 6–10, Bangla Version and English Version, with a curriculum-grounded bilingual tutor.";
  const ogImage = toOwnAssetUrl(meta.og_image_url);
  const favicon = toOwnAssetUrl(meta.favicon_url) ?? "/favicon.svg";
  const ogVideo = toOwnAssetUrl(meta.og_video_url);
  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title },
      { name: "description", content: description },
      { name: "theme-color", content: "#191D23" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "IntelliHorizon" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: ogImage ? "summary_large_image" : "summary" },
      ...(ogImage ? [{ property: "og:image", content: ogImage }, { name: "twitter:image", content: ogImage }] : []),
      ...(ogVideo ? [{ property: "og:video", content: ogVideo }] : []),
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,500&family=Hind+Siliguri:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: favicon, type: favicon.endsWith(".svg") ? "image/svg+xml" : undefined },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  };
}

function NotFoundComponent() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="font-display text-5xl font-bold tracking-tight text-brand">404</p>
      <h1 className="font-display text-2xl font-bold">This page isn't on the map.</h1>
      <Link to="/" className="inline-flex h-12 items-center rounded-[14px] bg-brand px-5 font-semibold text-white">
        Go to the home page
      </Link>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportHiggsfieldError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <main className="theme-night flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong on our side.</h1>
      <p className="text-cloth-mid">Your learning record is safe. Try again in a moment.</p>
      <button
        type="button"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
        className="rounded-[14px] bg-thread px-5 py-2 font-semibold text-night-0 active:scale-[0.98]"
      >
        Try again
      </button>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => buildHead(appMeta),
  loader: () => getLearnerState(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const initial = Route.useLoaderData();

  useEffect(() => {
    applyUi(readUi());
  }, []);

  useEffect(() => {
    if (!__HF_DESIGN_INSPECTOR__) return;
    void import("../module/design-inspector/runtime")
      .then(({ installHiggsfieldDesignInspector }) => installHiggsfieldDesignInspector())
      .catch((error) => {
        reportHiggsfieldError(error instanceof Error ? error : new Error("Failed to load design inspector"), {
          boundary: "higgsfield_design_inspector_import",
        });
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LearnerProvider initial={initial}>
        <Outlet />
        <PwaManager />
      </LearnerProvider>
    </QueryClientProvider>
  );
}
