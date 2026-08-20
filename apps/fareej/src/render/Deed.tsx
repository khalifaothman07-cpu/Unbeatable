/* =========================================================================
   Deed.tsx — the title deed for one space
   -------------------------------------------------------------------------
   Opened by tapping a space. Read-only on purpose: the board is a map, and
   a sheet that both explains a space AND commits money is a sheet people
   are afraid to open. Everything actionable lives in the panels below.
   ========================================================================= */

import { CROSSING_RENT, EWA_MULTIPLIER } from "../game/board";
import { bare, full } from "../game/money";
import { GROUP_LABEL, GROUP_NOTE, isOwnable } from "../game/types";
import { TOWER, buildingRefund, isMortgaged, levelOf, mortgageValue, ownerOf, spaceAt, unmortgageCost } from "../game/rules";
import type { Estate } from "../game/rules";
import type { Player } from "../state/store";
import { GROUP_COLOUR, GROUP_INK } from "./boardGeometry";

const TIER = ["Bare", "1 villa", "2 villas", "3 villas", "4 villas", "Tower"];

export function Deed({
  index, estate, players, onClose,
}: {
  index: number; estate: Estate; players: Player[]; onClose: () => void;
}) {
  const space = spaceAt(index);
  const owner = ownerOf(estate, index);
  const level = levelOf(estate, index);
  const mortgaged = isMortgaged(estate, index);
  const colour = space.group ? GROUP_COLOUR[space.group] : "#7d8a91";
  const ink = space.group ? GROUP_INK[space.group] : "#f4f1ea";

  return (
    <div className="panel deed">
      {/* A real deed leads with what it IS, then what it is called, then the
          group it belongs to. The coloured band across the top is the whole
          reason a property board reads at arm's length, so it gets the full
          width rather than a stripe down the side. */}
      <div className="deed-head" style={{ background: colour, color: ink }}>
        <span className="deed-kind">Title deed</span>
        <b>{space.name}</b>
        <span className="deed-group">{space.group ? GROUP_LABEL[space.group] : " "}</span>
      </div>

      {space.note && <p className="deed-note">{space.note}</p>}
      {space.group && <p className="muted deed-group-note">{GROUP_NOTE[space.group]}</p>}

      {isOwnable(space) && (
        <>
          <div className="deed-row">
            <span>Price</span><b>{full(space.deed!.price)}</b>
          </div>

          {space.kind === "property" && (
            <table className="rents">
              <tbody>
                {space.deed!.rent.map((r, i) => (
                  <tr key={i} className={level === i ? "on" : ""}>
                    <th>{TIER[i]}</th>
                    <td>{bare(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {space.kind === "crossing" && (
            <table className="rents">
              <tbody>
                {CROSSING_RENT.map((r, i) => (
                  <tr key={i}><th>{i + 1} held</th><td>{bare(r)}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          {space.kind === "utility" && (
            <table className="rents">
              <tbody>
                <tr><th>One station</th><td>{EWA_MULTIPLIER.one}× the roll</td></tr>
                <tr><th>Both</th><td>{EWA_MULTIPLIER.both}× the roll</td></tr>
              </tbody>
            </table>
          )}

          {space.kind === "property" && (
            <div className="deed-row">
              <span>Villa · tower</span>
              <b>{full(space.deed!.buildCost)} each</b>
            </div>
          )}
          <div className="deed-row">
            <span>Mortgage · to clear</span>
            <b>{full(mortgageValue(index))} · {full(unmortgageCost(index))}</b>
          </div>
          {space.kind === "property" && level > 0 && (
            <div className="deed-row">
              <span>Buildings sell back at</span>
              <b>{full(buildingRefund(index))} each</b>
            </div>
          )}

          <div className="deed-row deed-owner">
            <span>Held by</span>
            <b>
              {owner === null ? "nobody yet"
                : <><i className="dot" style={{ background: players[owner].colour }} />{players[owner].name}</>}
              {mortgaged && " · mortgaged"}
              {level > 0 && ` · ${level === TOWER ? "tower" : `${level} villa${level === 1 ? "" : "s"}`}`}
            </b>
          </div>
        </>
      )}

      {space.kind === "tax" && (
        <div className="deed-row">
          <span>Charge</span>
          <b>{full(space.amount!)}{space.percent ? `, or ${space.percent}% of what you're worth` : ""}</b>
        </div>
      )}

      <button className="btn small ghost" onClick={onClose}>Close</button>
    </div>
  );
}
