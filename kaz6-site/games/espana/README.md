# 38–0 · La Liga

> Build the ultimate all-time La Liga XI, then simulate a 38-game season and chase a perfect, unbeaten **38–0**.

An independent, fan-made football draft game. Spin a generator to land on a real Spanish club and season, draft one player from that squad, build your XI position by position across a formation of your choice, then play out a full 38-game campaign against a realistic league. No build step, no dependencies — just static HTML, CSS, and JavaScript.

**[▶ Play it live](https://YOUR-USERNAME.github.io/laliga-38-0/)** · *(update this link after enabling GitHub Pages)*

---

## Features

- **Squad generator** — a slot-style roll lands on a real club + season; a shuffle-bag guarantees no repeats within a run.
- **26 clubs · 76 historic squads · ~1,000 player-seasons**, spanning 1981–2024 (Arconada's Sociedad and Clemente's Athletic through to Bellingham's Madrid and Girona's 2024 side).
- **Five formations** — 4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 3-4-3.
- **Two rating modes** — *season-accurate* (the player's rating in that exact era) or *all-time peak* (their best rating found anywhere in the database).
- **Re-rolls** — discard a squad you don't like (8 per run).
- **Hard mode** — hide ratings while drafting.
- **History-calibrated simulation** — outcomes track real La Liga; even a flawless XI lands near the all-time ceiling (~100 pts / 32 wins), and 38–0 is the lightning strike it should be.
- **Post-season player stats** — appearances, goals, assists, clean sheets, average rating, and a Player of the Season.
- **No duplicate players** — each footballer can be used once per XI, even across different eras.

## How to play

1. **Pick a formation** on the home screen and press *Start New Run*.
2. **Generate a squad** — you land on a real club and season.
3. **Draft a player** from that squad into an open slot (or re-roll).
4. Repeat until your XI is complete, then **simulate the 38-game season**.
5. Read the verdict, the final table, and every player's stat line — and try to beat your record.

## Run locally

It's a static site, so any local server works:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>. (Opening `index.html` directly via `file://` also works.)

## Deploy with GitHub Pages

**Option A — included workflow (recommended):** this repo ships with `.github/workflows/pages.yml`. Push to `main`, then in **Settings → Pages → Build and deployment**, set **Source: GitHub Actions**. Every push redeploys automatically.

**Option B — no workflow:** **Settings → Pages → Source: Deploy from a branch**, choose `main` / `root`.

## Project structure

```
laliga-38-0/
├── index.html            # markup + meta tags
├── css/
│   └── styles.css        # all styling
├── js/
│   ├── data.js           # the squad & opponent database (edit ratings here)
│   └── game.js           # generator, draft, formations, simulation, stats
├── .github/workflows/
│   └── pages.yml          # auto-deploy to GitHub Pages
├── LICENSE
└── README.md
```

`data.js` is loaded before `game.js`; the data file defines the global `CLUBS` and `OPPONENTS`, and `game.js` builds everything else from them.

### Editing the database

Each squad is a `{ season, players }` object inside a club. Every player is `[name, line, rating]` where `line` is `GK`, `DEF`, `MID`, or `ATT`. To add a season, drop a new object into that club's `seasons` array. "All-time peak" ratings are derived automatically as the highest rating a given name carries anywhere in the data.

## Tech

Vanilla HTML/CSS/JS. No frameworks, no build, no dependencies. Fonts (Anton, Sofia Sans) are loaded from Google Fonts.

## Disclaimer

This is an unofficial, non-commercial fan project. It is **not affiliated with, endorsed by, or sponsored by** any club, league, or governing body. Club and player names are used descriptively for an editorial game; no logos, crests, or likenesses are included. Player ratings and simulated statistics are an independent interpretation and do not represent any official rating system. Inspired by the format of 38-0.app and 82-0.com.

## License

Code is released under the [MIT License](LICENSE).
