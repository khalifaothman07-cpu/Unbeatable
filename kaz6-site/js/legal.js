/* ============================================================
   legal.js  ·  the live consent control on the privacy page
   ------------------------------------------------------------
   A privacy page that only DESCRIBES a choice is half a page.
   This one states the answer currently in force and lets it be
   changed in either direction, which is the part that makes the
   consent real — a permission you cannot withdraw is not a
   permission, it is a notice.

   It reads the same state machine the bar at the bottom uses,
   so the two can never disagree.
   ============================================================ */

import account from "./account.js";

const panel = document.querySelector("[data-consent-panel]");
const stateEl = document.querySelector("[data-consent-state]");
const actsEl = document.querySelector("[data-consent-acts]");

const COPY = {
  yes: "Counting is <b>on</b>. One random number is stored in this browser so your visits can be told apart. Nothing else about you is kept.",
  no: "Counting is <b>off</b>. Nothing is stored on this device and none of your visits are recorded at all.",
  none: "You haven’t answered yet. Nothing is stored on this device. Your visits are recorded without any identifier, so they can’t be linked to each other or to you.",
};

function button(label, value) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "legal-btn";
  b.textContent = label;
  b.addEventListener("click", () => {
    account.setConsent(value);
    paint();
  });
  return b;
}

function paint() {
  if (!panel || !stateEl || !actsEl) return;
  const state = account.consent();
  stateEl.innerHTML = COPY[state || "none"];

  actsEl.replaceChildren();
  /* Only ever offer the answer they are not already giving. A page showing
     both buttons when one is already in force makes you read the sentence
     twice to work out which one you're on. */
  if (state !== "yes") actsEl.appendChild(button("Turn counting on", "yes"));
  if (state !== "no") actsEl.appendChild(button("Turn counting off", "no"));
}

if (panel) {
  /* wait for the client so the first paint shows the real answer rather
     than flashing the default */
  account.ready.then(paint, paint);
}
