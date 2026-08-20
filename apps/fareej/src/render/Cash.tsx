/* =========================================================================
   Cash.tsx — money that moves
   -------------------------------------------------------------------------
   A balance that snaps from 1.5M to 1.3M tells you the number changed. It
   does not tell you that something HAPPENED TO YOU, and in a game where
   every turn is somebody taking money off somebody else, that is most of
   the drama.

   So the figure counts to its new value, and the change itself floats up
   off the banner in green or red. Both are short: this sits on a scoreboard
   that updates several times a turn, and anything longer would still be
   animating when the next thing lands.
   ========================================================================= */

import { useEffect, useRef, useState } from "react";
import { short } from "../game/money";

/** Tween a number toward its target. Returns the value to paint. */
function useCounted(target: number, ms = 520): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = target;
    if (a === b) return;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      /* ease-out: money should arrive quickly and settle, not glide */
      const e = 1 - (1 - t) ** 3;
      setShown(Math.round(a + (b - a) * e));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); from.current = shown; };
    /* `shown` is deliberately not a dependency — it changes every frame, and
       depending on it would restart the tween on each one. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);

  return shown;
}

export function Cash({ amount, className }: { amount: number; className?: string }) {
  const shown = useCounted(amount);
  const prev = useRef(amount);
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null);

  useEffect(() => {
    const d = amount - prev.current;
    prev.current = amount;
    if (d === 0) return;
    setDelta({ n: d, key: Date.now() });
    const t = setTimeout(() => setDelta(null), 1100);
    return () => clearTimeout(t);
  }, [amount]);

  return (
    <span className={`cash ${className ?? ""} ${delta ? (delta.n > 0 ? "up" : "down") : ""}`}>
      {short(shown)}
      {delta && (
        <b key={delta.key} className={`cash-delta ${delta.n > 0 ? "up" : "down"}`}>
          {delta.n > 0 ? "+" : "−"}{short(Math.abs(delta.n))}
        </b>
      )}
    </span>
  );
}
