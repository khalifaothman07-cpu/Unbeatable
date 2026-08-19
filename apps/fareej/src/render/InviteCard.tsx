/* LIFTED FROM apps/luluaa/src/render/InviteCard.tsx — unchanged apart from
   the storage key and the wording. Fix a bug in one, fix it in the other. */
/* =========================================================================
   InviteCard.tsx — getting other people to the table
   -------------------------------------------------------------------------
   Four ways in, because the right one depends on where the friend is:

     share sheet  the phone's own Messages/WhatsApp/AirDrop list. On a
                  phone this is the whole job in one tap, so it leads.
     WhatsApp     the share sheet doesn't exist on desktop browsers, and
                  it's the obvious channel here anyway.
     QR           for someone sitting across the table. Nothing beats
                  pointing a camera — no typing, no message to send.
     the code     the last resort that always works: five characters,
                  read aloud, chosen from an alphabet with no 0/O/1/I.

   Copy is deliberately not the headline. "Copy" leaves the player holding
   something they still have to go and paste somewhere.
   ========================================================================= */

import { useState } from "react";
import qrcode from "qrcode-generator";

/** QR as one SVG path — crisp at any size, and no canvas to rasterise. */
export function qrPath(text: string): { d: string; size: number } {
  /* type 0 = smallest version that fits; M correction survives a thumb
     over one corner of a phone screen, which L would not */
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { d, size };
}

function QR({ text }: { text: string }) {
  const { d, size } = qrPath(text);
  const quiet = 4; // the spec's mandatory quiet zone; scanners need it
  const box = size + quiet * 2;
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${box} ${box}`}
      role="img"
      aria-label="Scan to join this table"
      shapeRendering="crispEdges"
    >
      <rect width={box} height={box} fill="#ffffff" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={d} fill="#1c1712" />
      </g>
    </svg>
  );
}

export function InviteCard({ url, code }: { url: string; code: string }) {
  const [note, setNote] = useState("");
  const [showQR, setShowQR] = useState(false);

  const message = `Take a seat at my FAREEJ table — code ${code}\n${url}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="invite">
      <div className="row">
        {canShare && (
          <button
            className="btn small"
            onClick={async () => {
              try {
                await navigator.share({ title: "FAREEJ — Isle of Pearls", text: message, url });
              } catch {
                /* the player dismissing the sheet throws too, so say nothing
                   rather than report a cancellation as a failure */
              }
            }}
          >
            Send invite
          </button>
        )}

        {/* WhatsApp carries the weight when there's no share sheet — a desktop
            browser, or an older phone — so there is always exactly one
            obvious way to send, never a row of equal-looking options. */}
        <a
          className={`btn small ${canShare ? "ghost" : ""}`}
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>

        <button
          className="btn tiny ghost"
          aria-pressed={showQR}
          onClick={() => setShowQR((v) => !v)}
        >
          {showQR ? "Hide QR" : "Show QR"}
        </button>

        <button
          className="btn tiny ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setNote("Link copied.");
            } catch {
              setNote("Couldn't copy — the link is below, hold to select it.");
            }
            setTimeout(() => setNote(""), 2200);
          }}
        >
          Copy link
        </button>
      </div>

      {showQR && (
        <div className="qr-wrap">
          <QR text={url} />
          <p className="muted">Point a camera at this — it opens straight to the seat picker.</p>
        </div>
      )}

      <p className="invite-code">
        or read out the code <b>{code}</b>
      </p>
      <code className="invite-url">{url}</code>
      {note && <p className="muted">{note}</p>}
    </div>
  );
}
