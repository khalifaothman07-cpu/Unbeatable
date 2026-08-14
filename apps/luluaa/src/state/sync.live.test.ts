/* =========================================================================
   sync.live.test.ts — two devices, one table, the real backend
   -------------------------------------------------------------------------
   Everything else in this suite is pure logic. This one is deliberately not:
   it stands up two independent copies of the store, points them at the real
   Supabase project, and plays a few moves across them. Multi-device sync is
   the one part of the game that cannot be proved by reasoning about a single
   process — the failure modes are all in the seam (echo loops, seat
   ownership, snapshots arriving out of order), and a mocked backend would
   reproduce the seam I wrote rather than the one that exists.

   Each client is a SEPARATE MODULE INSTANCE, via resetModules + dynamic
   import. Importing the store twice normally hands back one shared
   singleton, which would make this test pass no matter how broken sync is.

   Skips itself when the backend is unreachable or unconfigured, so a plain
   `npm test` on a plane still goes green.
   ========================================================================= */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { canPlaceBarasti } from "../game/rules";

/* vitest loads the committed .env the same way a vite build does, so the
   module under test sees the real project through import.meta.env and this
   file just needs the same values to probe reachability and clean up. */
const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let reachable = false;
const created: string[] = [];

beforeAll(async () => {
  try {
    const res = await fetch(`${URL}/rest/v1/luluaa_games?select=room_code&limit=1`, {
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
  /* anon has no delete right on the table any more — closing a room goes
     through the function that requires its code, which is the same path the
     app uses */
  const c = createClient(URL, KEY);
  for (const code of created) await c.rpc("luluaa_close_room", { p_code: code });
});

/** A fresh, isolated copy of the store module. */
async function newClient() {
  const { resetModules } = await import("vitest").then((m) => ({ resetModules: m.vi.resetModules }));
  resetModules();
  const mod = await import("./store");
  return mod.useGame;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll a condition rather than sleeping a fixed time — realtime latency varies. */
async function until(cond: () => boolean, ms = 15000, step = 250) {
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
    expect(host).not.toBe(guest); // separate module instances, or this proves nothing

    /* --- host opens seat 2 online; that is what creates the room --- */
    await host.getState().openSeat(1);
    const code = host.getState().roomCode!;
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    created.push(code);

    /* --- guest joins that seat --- */
    const ok = await guest.getState().joinRoom(code, 1);
    expect(ok).toBe(true);
    expect(guest.getState().mySeat).toBe(1);

    /* the guest rebuilt the board from the seed rather than being shipped it */
    expect(guest.getState().board.seed).toBe(host.getState().board.seed);
    expect(Object.keys(guest.getState().geo.vertices).length)
      .toBe(Object.keys(host.getState().geo.vertices).length);

    /* --- seat ownership: neither device may drive the other's seat --- */
    const { drivesSeat } = await import("./store");
    expect(drivesSeat(host.getState(), 1)).toBe(false); // host gave seat 2 away
    expect(drivesSeat(host.getState(), 0)).toBe(true);  // and kept seat 1
    expect(drivesSeat(guest.getState(), 1)).toBe(true); // guest owns only its own
    expect(drivesSeat(guest.getState(), 0)).toBe(false);

    /* --- a host move must reach the guest --- */
    const vertex = Object.keys(host.getState().geo.vertices)[0];
    host.getState().clickVertex(vertex);
    const placed = host.getState().buildings[vertex];
    expect(placed).toBeTruthy();

    const arrived = await until(() => Boolean(guest.getState().buildings[vertex]));
    expect(arrived, "host's placement never reached the guest").toBe(true);
    expect(guest.getState().buildings[vertex]?.player).toBe(placed.player);

    /* --- and it must SETTLE, not ping-pong. If the echo guard regressed the
           two clients would keep rewriting each other and updatedAt would
           climb without either device doing anything. --- */
    await wait(2500);
    const a = host.getState().lastPushedAt;
    const b = guest.getState().lastPushedAt;
    await wait(3000);
    expect(host.getState().lastPushedAt, "host kept republishing with no input").toBe(a);
    expect(guest.getState().lastPushedAt, "guest kept republishing with no input").toBe(b);

    host.getState().stopSync();
    guest.getState().stopSync();
  }, 60000);

  it("plays the whole opening draft across two devices, in turn order", async () => {
    if (!reachable) return;

    const host = await newClient();
    const guest = await newClient();
    const { drivesSeat, activeSeat } = await import("./store");

    await host.getState().openSeat(1);           // seat 2 goes online
    const code = host.getState().roomCode!;
    created.push(code);
    expect(await guest.getState().joinRoom(code, 1)).toBe(true);
    await until(() => guest.getState().link === "live");

    /* Snake draft: 0,1,2,3,3,2,1,0 — so the two devices genuinely alternate
       rather than one racing ahead. Each move is made on whichever device
       actually owns the seat that is up, which is the real test: a move made
       on the wrong device would be rejected and the draft would stall. */
    for (let step = 0; step < 16; step++) {
      const lead = host.getState().phase === "setup" ? host : guest;
      const seat = activeSeat(lead.getState());
      const device = drivesSeat(host.getState(), seat) ? host : guest;
      const other = device === host ? guest : host;

      if (device.getState().phase !== "setup") break;

      /* both devices must agree on whose turn it is before anyone moves */
      const agreed = await until(() => activeSeat(other.getState()) === activeSeat(device.getState())
        && other.getState().setupStage === device.getState().setupStage);
      expect(agreed, `devices disagreed about the table at step ${step}`).toBe(true);

      const st = device.getState();
      if (st.setupStage === "barasti") {
        const spot = Object.keys(st.geo.vertices).find((v) =>
          canPlaceBarasti(v, seat, st.buildings, st.routes, st.geo, true));
        expect(spot, `no legal barasti at step ${step}`).toBeTruthy();
        device.getState().clickVertex(spot!);
      } else {
        const edge = st.geo.vertexEdges[st.lastSetupVertex!].find((e) => st.routes[e] === undefined);
        expect(edge, `no legal route at step ${step}`).toBeTruthy();
        device.getState().clickEdge(edge!);
      }

      /* the move has to reach the other device before the draft moves on */
      const seen = await until(() =>
        Object.keys(other.getState().buildings).length === Object.keys(device.getState().buildings).length
        && Object.keys(other.getState().routes).length === Object.keys(device.getState().routes).length);
      expect(seen, `move ${step} never reached the other device`).toBe(true);
    }

    /* eight huts and eight routes, and both devices holding the same table */
    expect(Object.keys(host.getState().buildings)).toHaveLength(8);
    expect(Object.keys(host.getState().routes)).toHaveLength(8);
    expect(Object.keys(guest.getState().buildings).sort())
      .toEqual(Object.keys(host.getState().buildings).sort());
    expect(guest.getState().phase).toBe(host.getState().phase);
    expect(guest.getState().current).toBe(host.getState().current);

    host.getState().stopSync();
    guest.getState().stopSync();
  }, 120000);

  it("refuses a seat two devices both reach for", async () => {
    if (!reachable) return;

    const host = await newClient();
    const first = await newClient();
    const second = await newClient();

    await host.getState().openSeat(1);
    const code = host.getState().roomCode!;
    created.push(code);

    expect(await first.getState().joinRoom(code, 1)).toBe(true);
    /* the seat is gone — the database refuses it, not the client */
    expect(await second.getState().joinRoom(code, 1)).toBe(false);
    expect(second.getState().mySeat).not.toBe(1);

    host.getState().stopSync();
    first.getState().stopSync();
    second.getState().stopSync();
  }, 40000);

  it("refuses a seat the host never opened", async () => {
    if (!reachable) return;

    const host = await newClient();
    const guest = await newClient();

    await host.getState().openSeat(1);
    const code = host.getState().roomCode!;
    created.push(code);

    /* seat 3 is still local to the host — taking it would leave two devices
       driving one seat, each silently overwriting the other */
    const ok = await guest.getState().joinRoom(code, 2);
    expect(ok).toBe(false);
    expect(guest.getState().mySeat).not.toBe(2);

    host.getState().stopSync();
    guest.getState().stopSync();
  }, 40000);
});

describe("a joined device only ever sees its own cards", () => {
  it("shows your seat's hand, not whoever is playing", async () => {
    if (!reachable) return;

    const host = await newClient();
    const guest = await newClient();
    const { visibleSeat } = await import("./store");

    await host.getState().openSeat(1);
    const code = host.getState().roomCode!;
    created.push(code);
    expect(await guest.getState().joinRoom(code, 1)).toBe(true);

    /* seat 2 is the guest's; seat 1 is up. The hand on their screen must be
       their own, or the game leaks every hand to every device. */
    expect(guest.getState().mySeat).toBe(1);
    expect(visibleSeat(guest.getState())).toBe(1);

    /* and it stays theirs as the turn moves around the table */
    for (const current of [1, 2, 3, 0]) {
      guest.setState({ current });
      expect(visibleSeat(guest.getState()), `guest peeked at seat ${current}`).toBe(1);
    }

    /* the host holds the whole table on one device, so it does follow the
       active seat — that is pass-and-play, and the privacy screen covers it */
    expect(visibleSeat(host.getState())).toBe(host.getState().current);

    host.getState().stopSync();
    guest.getState().stopSync();
  }, 40000);
});
