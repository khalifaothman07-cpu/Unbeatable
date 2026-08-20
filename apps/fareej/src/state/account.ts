/* =========================================================================
   account.ts — a loader, not an implementation
   -------------------------------------------------------------------------
   The real client is kaz6-site/js/account.js, and it is the ONLY copy. It
   is loaded here at runtime rather than imported at build time, because the
   games are built by Vite from their own roots and anything imported would
   be bundled — which would give LU'LU'A one copy, FAREEJ a second, and the
   site a third, all free to drift.

   The dynamic import is marked @vite-ignore so Vite leaves the path alone.
   Left to itself it rewrites absolute paths through `base`, turning
   /js/account.js into /games/fareej/js/account.js — a file that does not
   exist. In production the games are served from the same origin as the
   site, so the bare absolute path is correct.

   IN DEV THERE IS NO SITE. `npm run dev` serves this app alone, the import
   404s, and every function here becomes a no-op. That is deliberate and
   matches how sync.ts already treats a missing Supabase config: the game
   works completely without it, and nothing about accounts is allowed to be
   load-bearing.
   ========================================================================= */

export interface AccountApi {
  ready: Promise<unknown>;
  signIn: () => void;
  signOut: () => void;
  isSignedIn: () => boolean;
  displayName: () => string | null;
  recordVisit: (extra?: { game?: string }) => void;
}

declare global {
  interface Window { kaz6account?: AccountApi }
}

const SITE_CLIENT = "/js/account.js";

let loading: Promise<AccountApi | null> | null = null;

/* Read through a function rather than touching window.kaz6account twice.
   The import installs it as a side effect, which the compiler cannot see —
   so after an early `if (window.kaz6account) return …` it narrows the
   property to undefined and the second read types as `never`. A call's
   result is not narrowed by an earlier call, so this reads honestly. */
function installed(): AccountApi | undefined {
  return typeof window === "undefined" ? undefined : window.kaz6account;
}

/** The shared client, or null when it isn't there (dev, or offline). */
export function account(): Promise<AccountApi | null> {
  if (loading) return loading;
  loading = (async () => {
    if (typeof window === "undefined") return null;
    const already = installed();
    if (already) return already;
    try {
      /* The specifier is a variable, not a literal, so neither TypeScript
         nor Vite tries to resolve it at build time. As a literal, tsc
         reports "cannot find module '/js/account.js'" — correctly, since
         the file lives in the SITE, not in this app. */
      await import(/* @vite-ignore */ SITE_CLIENT);
      const api = installed();
      if (!api) return null;
      await api.ready;
      return api;
    } catch {
      /* not served here — the game carries on exactly as it always has */
      return null;
    }
  })();
  return loading;
}

/** The signed-in player's first name, or null. Never throws, never waits
    on a network round trip the caller has to think about. */
export async function signedInName(): Promise<string | null> {
  const a = await account();
  if (!a || !a.isSignedIn()) return null;
  return a.displayName();
}
