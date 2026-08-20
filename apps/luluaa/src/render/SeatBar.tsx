/* =========================================================================
   SeatBar.tsx — the Table model's controls (spec §9)
   -------------------------------------------------------------------------
   Seats are not a "mode". Each seat is independently local or remote, and
   any mix is valid — two friends on the host's couch, two more on their own
   phones, one game. Opening the FIRST remote seat is what creates the room;
   before that nothing touches the network.

   Joining is by link rather than by typed code wherever possible. A five
   character code read across a room is a transcription error waiting to
   happen, and the phone that has to type it is the one least able to. The
   code stays as the fallback for someone who only has it spoken aloud.
   ========================================================================= */

import { useEffect, useState } from "react";
import { fetchRoom, remoteConfigured } from "../state/sync";
import { useGame, type Seat } from "../state/store";
import { InviteCard } from "./InviteCard";

/** The URL a friend opens to land straight on the seat picker. */
function joinLink(code: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("room", code);
  u.hash = "";
  return u.toString();
}

const LINK_LABEL = {
  offline: "not connected",
  connecting: "connecting…",
  live: "live",
  error: "connection lost",
} as const;

export function SeatBar() {
  const s = useGame();
  const [joinCode, setJoinCode] = useState("");
  const [joinSeat, setJoinSeat] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  /* seats the room says are open, for a device that has a code but no game */
  const [roomSeats, setRoomSeats] = useState<Seat[] | null>(null);
  const [roomClaims, setRoomClaims] = useState<Record<string, boolean>>({});
  /* the lookup couldn't reach the room — offer every seat and let joinRoom,
     which re-reads the table, be the one to say no */
  const [blindPick, setBlindPick] = useState(false);

  const anyRemote = s.seats.some((x) => x.type === "remote");
  const joined = s.mySeat !== null && s.mySeat >= 0;

  /* A link with ?room= means "someone invited you" — prefill the code and
     look up which seats are actually free, so the picker offers real
     choices instead of four seats that may already be taken. */
  useEffect(() => {
    if (!remoteConfigured) return;
    const code = new URLSearchParams(window.location.search).get("room");
    if (!code) return;
    const room = code.toUpperCase();
    setJoinCode(room);
    setMsg("Looking up that table\u2026");
    let live = true;
    void (async () => {
      /* Never leave the picker sitting empty with no explanation: on a weak
         connection the lookup can hang far longer than anyone will wait, and
         "nothing happened" is the one outcome the player can't act on. */
      const got = await Promise.race([
        fetchRoom(room),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]);
      if (!live) return;
      if (!got) {
        setBlindPick(true);
        setMsg("Couldn't reach that table — pick your seat and press Join to retry.");
        return;
      }
      setMsg("");
      const seats = (got.snapshot.state as { seats?: Seat[] })?.seats ?? null;
      setRoomSeats(seats);
      setRoomClaims(got.claims);
      const free = seats?.findIndex((x, i) => x.type === "remote" && !got.claims[String(i)]) ?? -1;
      if (free >= 0) setJoinSeat(free);
      else setMsg(seats ? "Every open seat is taken." : "");
    })();
    return () => { live = false; };
  }, []);

  /* Which seats a joining device may pick: the host's view once we're in the
     room, otherwise whatever the fetched snapshot reported. */
  const taken = (i: number) => Boolean(s.claims[String(i)] ?? roomClaims[String(i)]);
  const pickable = (roomSeats ?? s.seats)
    .map((seat, i) => ({ seat, i }))
    .filter(({ seat, i }) => blindPick || (seat.type === "remote" && (!taken(i) || i === s.mySeat)));

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Table · seats</span>
        <span className="row" style={{ gap: 8 }}>
          {s.roomCode && <span className="code">room {s.roomCode}</span>}
          {s.syncing && (
            <span className={`link link--${s.link}`}>
              <i className="link-dot" />{LINK_LABEL[s.link]}
            </span>
          )}
        </span>
      </div>

      {!remoteConfigured && (
        <p className="muted">
          Online seats aren&rsquo;t configured on this build — everything runs locally on this device.
        </p>
      )}

      {/* One seat per line. As a wrapping row the four seats broke at
          different widths and their buttons stacked, which made a four-item
          list look like four different controls. The actions sit together on
          the right; none of them is the gold one, because the gold one on
          this screen is Start the game. */}
      <div className="seatlist">
        {s.seats.map((seat, i) => (
          <span key={i} className={`seatctl ${i === s.mySeat ? "mine" : ""}`}>
            {/* the player's name, which is "Seat N" until they sign in —
                so a signed-in host sees their own name here rather than
                finding out only once the game has started */}
            <b>{s.players[i].name}</b>
            <span className={`tag2 ${seat.type}`}>
              {i === s.mySeat ? "you"
                : seat.type === "bot" ? "bot"
                : seat.type === "remote" ? (taken(i) ? "taken" : "open")
                : "this device"}
            </span>
            {!joined && (
              <span className="seatctl-acts">
                {seat.type === "bot" ? (
                  <button className="btn tiny ghost" onClick={() => s.setSeatType(i, "local")}>Take over</button>
                ) : (
                  <button className="btn tiny ghost" onClick={() => s.setSeatType(i, "bot")}>Add bot</button>
                )}
                {remoteConfigured && seat.type !== "bot" && (
                  seat.type === "local" ? (
                    <button className="btn tiny ghost" onClick={() => void s.openSeat(i)}>Open online</button>
                  ) : (
                    <button className="btn tiny ghost" onClick={() => s.closeSeat(i)}>Make local</button>
                  )
                )}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* ---- host: hand out the link ---- */}
      {anyRemote && s.roomCode && !joined && (
        <>
          <p className="muted invite-lead">
            Send this to whoever is taking an open seat. Same wifi or not — it goes over the internet, so
            anyone with the link can sit down.
          </p>
          <InviteCard url={joinLink(s.roomCode)} code={s.roomCode} />
        </>
      )}

      {/* ---- joiner: take a seat ----
             Hidden once this device is hosting a room: the host is the
             table, so offering them a box to type a code into is just
             something else to misread. */}
      {remoteConfigured && !joined && !s.roomCode && (
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input"
            placeholder="ROOM CODE"
            value={joinCode}
            maxLength={6}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setRoomSeats(null); setBlindPick(true); }}
          />
          <select
            className="input"
            value={joinSeat ?? ""}
            onChange={(e) => setJoinSeat(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">Pick a seat…</option>
            {pickable.map(({ i }) => <option key={i} value={i}>Seat {i + 1}</option>)}
          </select>
          <button
            className="btn tiny"
            disabled={!joinCode.trim() || joinSeat === null}
            onClick={async () => {
              setMsg("Joining…");
              const ok = await s.joinRoom(joinCode.trim(), joinSeat!);
              setMsg(ok ? `You're in as Seat ${joinSeat! + 1}.` : "Couldn't take that seat — check the code, or it may be taken.");
            }}
          >
            Join
          </button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      )}

      {joined && (
        <p className="muted" style={{ marginTop: 8 }}>
          You&rsquo;re Seat {s.mySeat! + 1} at table <b>{s.roomCode}</b>. You&rsquo;ll only be able to act on your
          own turn — everything else updates as the others play.
        </p>
      )}

      {pickable.length === 0 && !joined && joinCode && roomSeats && !blindPick && (
        <p className="muted" style={{ marginTop: 8 }}>
          No free seats at that table. Ask the host to open one.
        </p>
      )}
    </div>
  );
}
