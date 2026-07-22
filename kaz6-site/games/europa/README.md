# 13–0 · Europa

> Build the ultimate all-time European XI, then simulate a 13-game campaign and chase a perfect, unbeaten **13–0**.

An independent, fan-made football draft game. Spin a generator to land on a real European club and season, draft one player from that squad, build your XI position by position across a formation of your choice, then play out a full 13-game campaign against a realistic league. No build step, no dependencies — just static HTML, CSS, and JavaScript.

**[▶ Play it live](https://YOUR-USERNAME.github.io/champions-league/)** · *(update this link after enabling GitHub Pages)*

---

## Features

- **Squad generator** — a slot-style roll lands on a real club + season; a shuffle-bag guarantees no repeats within a run.
- **27 clubs · 56 historic squads · ~650 player-seasons**, spanning 1961–2024 (Di Stéfano-era Real Madrid and the Lisbon Lions through to Haaland-era Man City).
- **Five formations** — 4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 3-4-3.
- **Two rating modes** — *season-accurate* (the player's rating in that exact era) or *all-time peak* (their best rating found anywhere in the database).
- **Re-rolls** — discard a squad you don't like (8 per run).
- **Hard mode** — hide ratings while drafting.
- **History-calibrated simulation** — the league is a fictional super-field of Europe.s greatest clubs, so even a flawless XI is pushed hard, and 13–0 is the lightning strike it should be.
- **Post-season player stats** — appearances, goals, assists, clean sheets, average rating, and a Player of the Season.
- **No duplicate players** — each footballer can be used once per XI, even across different eras.

## How to play

1. **Pick a formation** on the home screen and press *Start New Run*.
2. **Generate a squad** — you land on a real club and season.
3. **Draft a player** from that squad into an open slot (or re-roll).
4. Repeat until your XI is complete, then **simulate the 13-game campaign**.
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
champions-league/
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

This is an unofficial, non-commercial fan project. It is **not affiliated with, endorsed by, or sponsored by** any club, league, or governing body. Club and player names are used descriptively for an editorial game; no logos, crests, or likenesses are included. Player ratings and simulated statistics are an independent interpretation and do not represent any official rating system. Inspired by the format of 13-0.app and 82-0.com.

## License

Code is released under the [MIT License](LICENSE).
