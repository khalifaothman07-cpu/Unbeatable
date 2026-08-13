/* =========================================================================
   feedback.ts — tactile response
   -------------------------------------------------------------------------
   Three channels, because no single one reaches every device: a short
   haptic (phones), a synthesised click (everywhere, no audio files to
   ship), and CSS press physics (see styles.css).

   Sound is generated with the Web Audio API rather than loaded — a board
   game needs a handful of short, dry noises, and synthesising them keeps
   the bundle free of binary assets and the page free of extra requests.

   Everything here is best-effort and silent on failure: audio may be
   blocked until first gesture, and vibrate is unsupported on desktop and
   iOS Safari. Feedback must never be load-bearing.
   ========================================================================= */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    /* browsers suspend the context until a user gesture */
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone { freq: number; dur: number; type?: OscillatorType; gain?: number; sweep?: number; delay?: number }

function play(tones: Tone[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const t of tones) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const start = now + (t.delay ?? 0);
    osc.type = t.type ?? "triangle";
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, t.sweep), start + t.dur);
    /* quick attack, exponential tail — reads as a physical knock, not a beep */
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(t.gain ?? 0.06, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported — fine */ }
}

/** Generic button press: the one you feel most often, so keep it dry. */
export function tap() {
  play([{ freq: 320, dur: 0.05, type: "square", gain: 0.035, sweep: 210 }]);
  buzz(8);
}

/** A piece meeting the board — lower and woodier than a UI tap. */
export function place() {
  play([
    { freq: 180, dur: 0.09, type: "triangle", gain: 0.08, sweep: 90 },
    { freq: 520, dur: 0.04, type: "square", gain: 0.02, delay: 0.005 },
  ]);
  buzz([12, 20, 8]);
}

/** Dice landing. */
export function diceRoll() {
  play([
    { freq: 140, dur: 0.05, type: "square", gain: 0.05, delay: 0 },
    { freq: 190, dur: 0.05, type: "square", gain: 0.045, delay: 0.07 },
    { freq: 160, dur: 0.07, type: "triangle", gain: 0.06, delay: 0.14, sweep: 110 },
  ]);
  buzz([10, 40, 14, 30, 18]);
}

/** Resources arriving. */
export function gain() {
  play([
    { freq: 640, dur: 0.06, gain: 0.045 },
    { freq: 880, dur: 0.09, gain: 0.04, delay: 0.05 },
  ]);
  buzz(10);
}

/** Something taken from you — the Shamal, or a Souq Corner. */
export function loss() {
  play([{ freq: 300, dur: 0.16, type: "sawtooth", gain: 0.05, sweep: 90 }]);
  buzz([18, 30, 26]);
}

/** Illegal action. Deliberately short and unmusical. */
export function nope() {
  play([{ freq: 120, dur: 0.08, type: "square", gain: 0.05 }]);
  buzz(30);
}

/** Win. The only flourish in the whole game. */
export function fanfare() {
  play([
    { freq: 523, dur: 0.12, gain: 0.06 },
    { freq: 659, dur: 0.12, gain: 0.06, delay: 0.1 },
    { freq: 784, dur: 0.14, gain: 0.06, delay: 0.2 },
    { freq: 1047, dur: 0.28, gain: 0.07, delay: 0.32 },
  ]);
  buzz([30, 60, 30, 60, 90]);
}
