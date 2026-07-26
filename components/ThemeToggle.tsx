"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// The effective theme lives outside React: an explicit choice in
// localStorage, otherwise the OS preference. `themechange` re-reads it after
// a click; the media-query listener follows OS switches while on "system".
function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  window.addEventListener("themechange", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall through to system.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function apply(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("theme", t);
  } catch {
    // Without storage the choice still applies for this visit.
  }
  window.dispatchEvent(new Event("themechange"));
}

export default function ThemeToggle() {
  // null while server-rendering — the server can't know the visitor's theme.
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => null);

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
      <button
        onClick={() => apply("dark")}
        aria-label="Dark mode"
        aria-pressed={theme === "dark"}
        className={`flex size-7 items-center justify-center rounded-md transition-colors ${
          theme === "dark" ? "bg-line text-ink" : "text-ink-3 hover:text-ink-2"
        }`}
      >
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>
      <button
        onClick={() => apply("light")}
        aria-label="Light mode"
        aria-pressed={theme === "light"}
        className={`flex size-7 items-center justify-center rounded-md transition-colors ${
          theme === "light" ? "bg-line text-ink" : "text-ink-3 hover:text-ink-2"
        }`}
      >
        <svg {...ICON_PROPS} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      </button>
    </div>
  );
}
