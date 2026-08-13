import { useCallback, useState } from "react";
import { generateBoard, freshSeed } from "./game/board";
import { DEFAULT_BOARD, SMALL_BOARD, TERRAIN_LABEL, type BoardConfig } from "./game/types";
import { BoardView } from "./render/BoardView";

export function App() {
  const [config, setConfig] = useState<BoardConfig>(DEFAULT_BOARD);
  const [board, setBoard] = useState(() => generateBoard(DEFAULT_BOARD, freshSeed()));

  /* "New Game" always regenerates from a fresh seed — never a repeat. */
  const regenerate = useCallback(
    (next: BoardConfig = config) => {
      setConfig(next);
      setBoard(generateBoard(next, freshSeed()));
    },
    [config]
  );

  const counts = board.tiles.reduce<Record<string, number>>((acc, t) => {
    acc[t.terrain] = (acc[t.terrain] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="shell">
      <a className="kaz6-home" href="../../index.html">← KAZ6</a>

      <header className="head">
        <p className="eyebrow">Isle of Pearls</p>
        <h1 className="wordmark">LU&rsquo;LU&rsquo;A</h1>
        <p className="tagline">
          Dive the pearl banks, run the dhow routes, and build from barasti to qasr. Every board is
          dealt fresh — terrain, numbers and trade posts reshuffled each game.
        </p>
      </header>

      <div className="controls">
        <button className="btn" onClick={() => regenerate()}>Deal a new board</button>
        <div className="seg">
          <button
            className={config === DEFAULT_BOARD ? "segBtn on" : "segBtn"}
            onClick={() => regenerate(DEFAULT_BOARD)}
          >
            30 tiles
          </button>
          <button
            className={config === SMALL_BOARD ? "segBtn on" : "segBtn"}
            onClick={() => regenerate(SMALL_BOARD)}
          >
            16 tiles
          </button>
        </div>
      </div>

      <BoardView board={board} />

      <div className="legend">
        {Object.entries(counts).map(([terrain, n]) => (
          <span className="chip" key={terrain}>
            <i className={`sw sw-${terrain}`} aria-hidden="true" />
            {TERRAIN_LABEL[terrain as keyof typeof TERRAIN_LABEL]} <b>{n}</b>
          </span>
        ))}
      </div>

      <p className="note">
        Board generation is complete and rule-checked — no two 6s, 8s, or a 6 and 8 ever touch.
        Placement, trading, dhow cards and the Shamal are still to come.
      </p>
      <p className="seed">seed {board.seed}</p>
    </div>
  );
}
