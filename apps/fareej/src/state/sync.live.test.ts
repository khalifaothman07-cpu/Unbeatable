/* =========================================================================
   sync.live.test.ts — two devices, one table, the real backend
   -------------------------------------------------------------------------
   Everything else in this suite is pure logic. This one is deliberately not:
   it stands up two independent copies of the store, points them at the real
   Supabase project, and plays a few moves across them.

   Multi-device sync is the one part of a game that cannot be proved by
   reasoning about a single process. The failure modes all live in the seam —
   echo loops, seat ownership, snapshots arriving out of order — and a mocked
   backend would reproduce the seam I wrote rather than the one that exists.

   Each client is a SEPARATE MODULE INSTANCE, via resetModules plus a dynamic
   import. Importing the store twice normally hands back one shared singleton,
   which would make this test pass no matter how broken sync is.

   Skips itself when the backend is unreachable, so `npm test` on a plane
   still goes green.

   TIMING. This suite is the only one here that waits on a network, and it
   runs alongside eight other files competing for the same machine. It
   passed on its own and failed twice in a full run, which is a tight window
   rather than a broken seam — so the waits below are generous on purpose.
   If you tighten them to make the suite feel quicker you will get a test
   that fails for reasons that have nothing to do with the code.
   ========================================================================= */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let reachable = false;
const created: string[] = [];

beforeAll(async () => {
  try {
    const res = await fetch(`${URL}/rest/v1/fareej_games?select=room_code&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    reachable = res.ok;
  } catch {
    reachable = false;
  }
});

afterAll(async () => {
  if (!reachable || !created.length) return;
  /* anon has no delete right on the table — closing a room goes through the
     function that requires its code, the same path the app uses */
  const c = createClient(URL, KEY);
  for (const code of created) await c.rpc("fareej_close_room", { p_code: code });
});

/** A fresh, isolated copy of the store module. */
async function newClient() {
  vi.resetModules();
  const mod = await import("./store");
  return mod;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll a condition rather than sleeping a fixed time — latency varies.
    The fallback poll inside the app runs every 4s, so any window has to be
    a comfortable multiple of that even when realtime is not delivering. */
async function until(cond: () => boolean, ms = 30000, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (cond()) return true;
    await wait(step);
  }
  return cond();
}

describe("two devices on one table", () => {
  it("mirrors the host's board to a joined device, and lets only the seat's owner act", async () => {
    if (!reachable) {
      console.warn("[sync.live] Supabase unreachable — skipping the live two-client test");
      return;
    }

    const host = await newClient();
    const guest = await newClient();
    expect(host.useGame).not.toBe(guest.useGame); // separate instances, or this proves nothing

    /* --- host opens seat 2 online; that is what creates the room --- */
    await host.useGame.getState().openSeat(1);
    const code = host.useGame.getState().roomCode!;
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    created.push(code);

    /* --- guest joins that seat --- */
    expect(await guest.useGame.getState().joinRoom(code, 1)).toBe(true);
    expect(guest.useGame.getState().mySeat).toBe(1);

    /* --- seat ownership: neither device may drive the other's seat --- */
    expect(host.drivesSeat(host.useGame.getState(), 1)).toBe(false);  // given away
    expect(host.drivesSeat(host.useGame.getState(), 0)).toBe(true);   // and kept
    expect(guest.drivesSeat(guest.useGame.getState(), 1)).toBe(true); // only its own
    expect(guest.drivesSeat(guest.useGame.getState(), 0)).toBe(false);

    /* --- a host move must reach the guest --- */
    host.useGame.getState().startGame();
    const arrived = await until(() => guest.useGame.getState().started === true);
    expect(arrived, "the host starting the game never reached the guest").toBe(true);
    expect(guest.useGame.getState().phase).toBe("roll");

    /* --- and it must SETTLE, not ping-pong. If the echo guard regressed,
           the two clients would keep rewriting each other and lastPushedAt
           would climb with nobody touching anything. --- */
    await wait(2500);
    const a = host.useGame.getState().lastPushedAt;
    const b = guest.useGame.getState().lastPushedAt;
    await wait(3000);
    expect(host.useGame.getState().lastPushedAt, "host kept republishing with no input").toBe(a);
    expect(guest.useGame.getState().lastPushedAt, "guest kept republishing with no input").toBe(b);

    host.useGame.getState().stopSync();
    guest.useGame.getState().stopSync();
  }, 90000);

  it("carries a whole turn across, deeds and cash included", async () => {
    if (!reachable) return;

    const host = await newClient();
    const guest = await newClient();

    await host.useGame.getState().openSeat(1);
    const code = host.useGame.getState().roomCode!;
    created.push(code);
    expect(await guest.useGame.getState().joinRoom(code, 1)).toBe(true);
    host.useGame.getState().startGame();
    await until(() => guest.useGame.getState().started === true);

    /* the host rolls its own seat and buys whatever it lands on */
    host.useGame.getState().roll();
    if (host.useGame.getState().phase === "buy") host.useGame.getState().buy();
    const at = host.useGame.getState().players[0].at;
    const cash = host.useGame.getState().players[0].cash;

    const seen = await until(() =>
      guest.useGame.getState().players[0].at === at
      && guest.useGame.getState().players[0].cash === cash);
    expect(seen, "the host's move never reached the guest").toBe(true);
    expect(guest.useGame.getState().estate.owner).toEqual(host.useGame.getState().estate.owner);

    host.useGame.getState().stopSync();
    guest.useGame.getState().stopSync();
  }, 90000);

  it("refuses a seat two devices both reach for", async () => {
    if (!reachable) return;

    const host = await newClient();
    const first = await newClient();
    const second = await newClient();

    await host.useGame.getState().openSeat(1);
    const code = host.useGame.getState().roomCode!;
    created.push(code);

    expect(await first.useGame.getState().joinRoom(code, 1)).toBe(true);
    /* the seat is gone — the database refuses it, not the client */
    expect(await second.useGame.getState().joinRoom(code, 1)).toBe(false);
    expect(second.useGame.getState().mySeat).not.toBe(1);

    host.useGame.getState().stopSync();
    first.useGame.getState().stopSync();
    second.useGame.getState().stopSync();
  }, 60000);

  it("refuses a seat the host never opened", async () => {
    if (!reachable) return;

    const host = await newClient();
    const guest = await newClient();

    await host.useGame.getState().openSeat(1);
    const code = host.useGame.getState().roomCode!;
    created.push(code);

    /* seat 3 is still local to the host — taking it would leave two devices
       driving one seat, each silently overwriting the other */
    expect(await guest.useGame.getState().joinRoom(code, 2)).toBe(false);
    expect(guest.useGame.getState().mySeat).not.toBe(2);

    host.useGame.getState().stopSync();
    guest.useGame.getState().stopSync();
  }, 60000);
});
