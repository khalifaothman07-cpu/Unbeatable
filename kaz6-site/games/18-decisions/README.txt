18 DECISIONS — a golf decision game · KAZ6 Studio
Framework-free, canvas + vanilla JS, no build step.

PLAY NOW
  Open  18-decisions.html  in any browser. That one file is the whole game.
  Best on a phone, portrait.

HOW IT PLAYS
  No aiming. Every shot you're handed 2-3 CLUB PLAYS — Attack / Position /
  Safe — each headlined by a real club from the 14-club bag, with a reward and
  a risk meter. Tap the card (or its marker on the hole) to commit. The risk on
  each play is measured by simulating that club against the hole's real
  hazards, so the percentage play can still find the water.
  Read the wind, watch your strike (Flushed / Solid / Pushed / Yanked), string
  birdies for a Heater, and chase your saved best over 9 or 18 holes.

WHAT'S UNDER THE HOOD (modular, edit one concern at a time)
  js/clubs.js     the 14-club bag (carry + dispersion)
  js/course.js    18 holes as real 2D geometry + surface detection
  js/sim.js       shot physics — distance, wind, lies, penalties, strike grade
  js/choices.js   builds the per-club plays + their measured risk/reward
  js/render.js    the canvas: hole graphics, choice markers, ball flight, juice
  js/game.js      flow, HUD, cards, streak, best, scorecard
  css/style.css   the UI

DEPLOY (drag-and-drop to Netlify, like Espana / Europa)
  Drag the CONTENTS of this folder; index.html is the entry point.

WIRING INTO THE SITE (when hosted)
  Flip golf from "concept" to "live" in the site's js/data.js — status + URL,
  the same one-line change as Espana / Europa. Not done here.

TUNING
  Difficulty, club distances, wind, hole shapes all live in clubs.js /
  course.js / sim.js. A course-managing player currently averages ~level par.

DRAFT — not final until Khalifa says so.
