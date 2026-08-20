/* LIFTED FROM apps/luluaa/src/state/useTheme.ts — unchanged apart from
   the storage key and the wording. Fix a bug in one, fix it in the other. */
/* =========================================================================
   useTheme.ts — light, dark, or whatever the phone is already doing
   -------------------------------------------------------------------------
   Three states, not two. "Auto" is the one most people actually want: a
   phone that goes dark at sunset should take the game with it, and a
   two-way switch forces a choice nobody asked to make. Light and Dark are
   there for the times the room disagrees with the operating system.

   The chosen mode is written to <html data-theme> and remembered. The CSS
   does the rest: the media query is guarded so a reader who picks Light is
   never overridden by their OS, and picking Dark works on a phone that has
   never heard of dark mode.

   The <meta name="theme-color"> is updated alongside, so iOS Safari's
   chrome matches the page instead of framing a dark game in a cream bar.
   ========================================================================= */

import { useCallback, useEffect, useState } from "react";

export type Theme = "auto" | "light" | "dark";
const KEY = "fareej.theme";
const ORDER: Theme[] = ["auto", "light", "dark"];

/** The ground actually in force right now, once "auto" is resolved. */
export function resolved(theme: Theme): "light" | "dark" {
  if (theme !== "auto") return theme;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark" : "light";
}

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "auto" ? v : "auto";
  } catch {
    return "auto";                     // private mode, or storage disabled
  }
}

function paint(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  /* read the ground back off the page rather than guessing it, so the
     browser chrome can never disagree with what's rendered */
  const bg = getComputedStyle(root).getPropertyValue("--sand").trim();
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  if (bg) meta.setAttribute("content", bg);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    paint(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* nothing to do */ }
  }, [theme]);

  /* on "auto", follow the phone if it changes underneath us */
  useEffect(() => {
    if (theme !== "auto" || typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => paint("auto");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);
  }, []);

  return { theme, setTheme, cycle, ground: resolved(theme) };
}
