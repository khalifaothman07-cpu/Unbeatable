/* =========================================================================
   invite.test.ts — the QR has to decode, not just look like a QR
   -------------------------------------------------------------------------
   A wrong QR is indistinguishable from a right one by eye: both are a grid
   of black squares with three corner markers. The only honest check is to
   render it exactly as the page does, then read it back with a decoder that
   knows nothing about how it was made.
   ========================================================================= */

import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { qrPath } from "./InviteCard";

/** Rasterise the SVG path the component emits, at scanner-ish resolution. */
function rasterise(text: string, scale = 8) {
  const { d, size } = qrPath(text);
  const quiet = 4;
  const box = size + quiet * 2;
  const w = box * scale;

  /* Start white, then paint the dark modules the path describes. Parsing our
     own "M{c} {r}h1v1h-1z" back out keeps this honest: if the path were
     malformed, the squares would land in the wrong places here too. */
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  const re = /M(\d+) (\d+)h1v1h-1z/g;
  let m: RegExpExecArray | null;
  let modules = 0;
  while ((m = re.exec(d))) {
    modules++;
    const c = Number(m[1]) + quiet;
    const r = Number(m[2]) + quiet;
    for (let y = r * scale; y < (r + 1) * scale; y++) {
      for (let x = c * scale; x < (c + 1) * scale; x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, w, size, modules };
}

const decode = (text: string) => {
  const { data, w } = rasterise(text);
  return jsQR(data, w, w)?.data ?? null;
};

describe("invite QR", () => {
  it("decodes back to the exact join link", () => {
    const url = "https://kaz6.netlify.app/games/luluaa/?room=Y3HPK";
    expect(decode(url)).toBe(url);
  });

  it("survives the longest realistic link", () => {
    /* a custom domain plus a deep path is the worst case the room code can
       find itself inside; the encoder picks its own version, so this is
       really checking that "smallest that fits" keeps fitting */
    const url = "https://www.khalifaothman-portfolio.example.com/games/luluaa/index.html?room=WXYZ9&utm_source=whatsapp";
    expect(decode(url)).toBe(url);
  });

  it("distinguishes one room from another", () => {
    const a = "https://kaz6.netlify.app/games/luluaa/?room=AAAAA";
    const b = "https://kaz6.netlify.app/games/luluaa/?room=BBBBB";
    expect(decode(a)).toBe(a);
    expect(decode(b)).toBe(b);
    expect(qrPath(a).d).not.toBe(qrPath(b).d);
  });

  it("keeps the quiet zone clear, or scanners won't lock on", () => {
    const { data, w, size } = rasterise("https://kaz6.netlify.app/games/luluaa/?room=Y3HPK");
    const scale = 8, quiet = 4 * scale;
    const dark = (x: number, y: number) => data[(y * w + x) * 4] === 0;

    expect(size).toBeGreaterThan(20);          // a real QR, not a stub
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < quiet; j++) {
        expect(dark(i, j), "top border").toBe(false);
        expect(dark(i, w - 1 - j), "bottom border").toBe(false);
        expect(dark(j, i), "left border").toBe(false);
        expect(dark(w - 1 - j, i), "right border").toBe(false);
      }
    }
  });
});
