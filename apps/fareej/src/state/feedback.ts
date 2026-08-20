/* LIFTED FROM apps/luluaa/src/state/feedback.ts — unchanged apart from
   the storage key and the wording. Fix a bug in one, fix it in the other. */
/* =========================================================================
   feedback.ts — tactile response
   -------------------------------------------------------------------------
   WHAT ACTUALLY REACHES AN IPHONE, which is what this file is shaped around:

   - navigator.vibrate has never been implemented in iOS Safari and still
     isn't. The <input type="checkbox" switch> trick that briefly gave pages
     access to the haptic engine was closed by Apple in iOS 26.5. We try it,
     because it costs nothing and still works on older phones, but no part of
     the design may depend on a phone buzzing.
   - Web Audio on iOS is routed to the RINGER channel, so a phone on silent
     plays nothing at all. navigator.audioSession — which Safari implements —
     moves us to the playback channel, which the mute switch doesn't govern.
     Older iOS needs the silent-<audio>-loop trick to do the same thing.
   - Which leaves motion as the only channel guaranteed on every device, so
     it has to carry the feel on its own rather than merely garnish the
     other two. See `pressFeedback` below and .btn:active in styles.css.

   Everything here is best-effort and silent on failure. Feedback must never
   be load-bearing.
   ========================================================================= */

let ctx: AudioContext | null = null;
let muted = false;
let unlocked = false;
let keepAlive: HTMLAudioElement | null = null;

export function setMuted(m: boolean) {
  muted = m;
  if (m) { keepAlive?.pause(); } else { void keepAlive?.play().catch(() => {}); }
}
export function isMuted() { return muted; }

/* A 100ms silent wav. Looping it holds iOS in an audio session that the
   ringer switch doesn't mute, which is the only way pre-audioSession
   iOS lets a web page make noise on a phone that's been silenced. */
const SILENCE =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/** Must be called from inside a real user gesture. Idempotent. */
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    /* Safari implements this; it is the clean way to say "this page's audio
       is playback, not a ringtone" and survives the mute switch. */
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch { /* not supported — fall through to the silent loop */ }

  try {
    keepAlive = new Audio(SILENCE);
    keepAlive.loop = true;
    keepAlive.volume = 0.001;
    (keepAlive as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    if (!muted) void keepAlive.play().catch(() => {});
  } catch { /* no <audio> — motion still carries the feel */ }

  /* create and resume the context inside the gesture, so the very first
     press makes a sound instead of the one after it */
  const ac = audio();
  if (ac && ac.state === "suspended") void ac.resume();
}

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

/* ---- haptics -------------------------------------------------------------
   One hidden switch, reused. Toggling it reaches the haptic engine on iOS
   17.4 through 26.4; everywhere else navigator.vibrate does the job and this
   never runs. Nothing observable happens when neither path works. */
let hapticSwitch: HTMLInputElement | null = null;
const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

function iosHaptic() {
  try {
    if (!hapticSwitch) {
      const el = document.createElement("input");
      el.type = "checkbox";
      el.setAttribute("switch", "");
      el.setAttribute("aria-hidden", "true");
      el.tabIndex = -1;
      el.style.cssText = "position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
      document.body.appendChild(el);
      hapticSwitch = el;
    }
    hapticSwitch.checked = !hapticSwitch.checked;
    hapticSwitch.dispatchEvent(new Event("change", { bubbles: false }));
  } catch { /* no haptics here */ }
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
  if (muted) return;
  try {
    if (canVibrate && navigator.vibrate(pattern)) return;
  } catch { /* fall through */ }
  iosHaptic();
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

/* ---- press motion --------------------------------------------------------
   :active alone is not enough on a phone. A quick tap can hold it for a
   handful of milliseconds — less than a single frame at 60Hz — so the
   button visibly does nothing, which is exactly the "I'm just pressing
   buttons" complaint. Driving the pressed state from JS lets us hold it for
   a minimum span, so every press registers no matter how fast the finger
   leaves, and lets the ripple start from where the finger actually landed
   rather than from the middle of the button. */

const HOLD_MS = 130;

export function pressFeedback(el: HTMLElement, x?: number, y?: number) {
  try {
    el.classList.remove("pressing");
    /* reading offsetWidth restarts the animation on a rapid second tap */
    void el.offsetWidth;
    el.classList.add("pressing");
    window.setTimeout(() => el.classList.remove("pressing"), HOLD_MS);

    const r = el.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    const size = Math.max(r.width, r.height) * 2.2;
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${(x ?? r.left + r.width / 2) - r.left - size / 2}px`;
    ripple.style.top = `${(y ?? r.top + r.height / 2) - r.top - size / 2}px`;
    el.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 460);
  } catch { /* never let decoration break a click */ }
}

/** Everything a button press should do, in one call. */
export function press(el: HTMLElement, x?: number, y?: number) {
  unlock();
  pressFeedback(el, x, y);
  tap();
}
