/* =========================================================================
   SeatBar.tsx — the Table model's controls (spec §9)
   -------------------------------------------------------------------------
   Seats are not a "mode". Each seat is independently local or remote, and
   any mix is valid — two friends on the host's couch, two more on their own
   phones, one game. Opening the FIRST remote seat is what creates the room;
   before that nothing touches the network.
   ========================================================================= */

import { useState } from "react";
import { remoteConfigured } from "../state/sync";
import { useGame } from "../state/store";

export function SeatBar() {
  const s = useGame();
  const [joinCode, setJoinCode] = useState("");
  const [joinSeat, setJoinSeat] = useState(0);
  const [msg, setMsg] = useState("");

  const anyRemote = s.seats.some((x) => x.type === "remote");

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Table · seats</span>
        {s.roomCode && <span className="code">room {s.roomCode}</span>}
      </div>

      {!remoteConfigured && (
        <p className="muted">
          Online seats aren&rsquo;t configured on this build — everything runs locally on this device.
        </p>
      )}

      <div className="row">
        {s.seats.map((seat, i) => (
          <span key={i} className="seatctl">
            <b>Seat {i + 1}</b>
            <span className={`tag2 ${seat.type}`}>{seat.type === "remote" ? "online" : "this device"}</span>
            {remoteConfigured && (
              seat.type === "local" ? (
                <button className="btn tiny" onClick={() => void s.openSeat(i)}>Open online</button>
              ) : (
                <button className="btn tiny" onClick={() => s.closeSeat(i)}>Make local</button>
              )
            )}
          </span>
        ))}
      </div>

      {anyRemote && s.roomCode && (
        <p className="muted" style={{ marginTop: 8 }}>
          Share code <b>{s.roomCode}</b>. Friends open this page, enter it below, and pick their seat.
        </p>
      )}

      {remoteConfigured && (
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input"
            placeholder="ROOM CODE"
            value={joinCode}
            maxLength={6}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <select className="input" value={joinSeat} onChange={(e) => setJoinSeat(Number(e.target.value))}>
            {s.seats.map((_, i) => <option key={i} value={i}>Seat {i + 1}</option>)}
          </select>
          <button
            className="btn tiny"
            onClick={async () => {
              setMsg("Joining…");
              const ok = await s.joinRoom(joinCode.trim(), joinSeat);
              setMsg(ok ? `Joined as Seat ${joinSeat + 1}.` : "No table with that code.");
            }}
          >
            Join
          </button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      )}
    </div>
  );
}
