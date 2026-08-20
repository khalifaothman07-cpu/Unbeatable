/* =========================================================================
   money.ts — every dinar figure in the game is written by this file
   -------------------------------------------------------------------------
   FAREEJ prices property at what property in Bahrain actually costs, which
   means numbers up to BD 1,500,000. Those do not fit on a 35px board space
   or inside a narrow button, so there are two forms:

     short()  60k, 1.5M      board spaces, buttons, chips
     full()   BD 1,500,000   deed cards, the wallet, the trade panel

   Both live here on purpose. The moment a component formats a number inline
   is the moment two halves of the same screen start disagreeing about what
   a figure is — which is a bug nobody reports, because it just looks like
   the game is confusing.

   Amounts are stored as whole dinars, never as thousands. Storing "60" and
   remembering it means 60,000 is exactly the kind of implicit unit that
   produces a rent charge a thousand times too small.
   ========================================================================= */

/** The unit everything is stored in. Whole dinars — no fils, no floats. */
export type Dinars = number;

/** Thousands helper, so board data can read `k(60)` and still store 60000. */
export const k = (thousands: number): Dinars => Math.round(thousands * 1000);

/** One decimal at most, and never a trailing zero. */
function trim(x: number): string {
  const one = Math.round(x * 10) / 10;
  return Number.isInteger(one) ? String(one) : one.toFixed(1);
}

/** Compact, for anywhere horizontal space is the constraint. */
export function short(n: Dinars): string {
  const sign = n < 0 ? "−" : "";
  const v = Math.abs(Math.round(n));
  /* 1.5M, but 2M rather than 2.0M — a trailing .0 is noise */
  if (v >= 1_000_000) return `${sign}${trim(v / 1_000_000)}M`;
  if (v >= 1_000) return `${sign}${trim(v / 1_000)}k`;
  return `${sign}${v}`;
}

/** The full figure, grouped, with the currency on the front. */
export function full(n: Dinars): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}BD ${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

/** Grouped digits with no currency mark — for tables that head their own
    column, where repeating "BD" on every row is just noise. */
export function bare(n: Dinars): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}
