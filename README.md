# Legend of the Red Dragon — Web Port

A faithful web port of the classic 1989 BBS door game *Legend of the Red Dragon* (LORD) by Seth Able Robinson. Built as a browser-playable Node.js/Express application with PostgreSQL persistence, retaining the original game's ASCII art aesthetic, color codes, and daily-play structure.

---

## Quick Start

### With Docker Compose (recommended)

```bash
docker compose up --build
```

The game will be available at `http://localhost:3001`.

### Without Docker

Requires Node.js 22+ and a PostgreSQL 16+ instance.

```bash
npm install
DATABASE_URL=postgresql://lord:lordpass@localhost:5432/lorddb \
SESSION_SECRET=your-secret-here \
node server.js
```

The database schema and migrations are applied automatically on startup.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://lord:lordpass@localhost:5432/lorddb` | PostgreSQL connection string |
| `SESSION_SECRET` | `change-me-in-production` | Express session secret — **change this in production** |
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `3000` | Internal HTTP port |

---

## Architecture

```
lord-web/
├── server.js          — Express app entry point, session config
├── db.js              — PostgreSQL pool, schema, all DB functions
├── routes/
│   ├── auth.js        — Login / register
│   └── game.js        — All game actions (POST /api/game/action)
├── game/
│   ├── engine.js      — Screen generation, ASCII banners, HP bars
│   ├── combat.js      — Round resolution, monster AI, flee formula
│   ├── data.js        — Static data: weapons, armors, 132 monsters
│   ├── forest_events.js — 20 non-combat forest encounters + monster art
│   └── newday.js      — Daily reset routine (HP, bank interest, etc.)
└── public/            — Frontend (HTML/CSS/JS, vanilla)
```

**Action flow:** Every player interaction is a `POST /api/game/action` with `{ action, param }`. The route handler reads player state from DB, processes the action, writes changes, and returns a `{ title, lines[], choices[] }` screen object that the frontend renders.

**Color codes:** Lines use backtick color codes inherited from LORD's original ANSI system (e.g. `` `$ `` = bright yellow, `` `@ `` = bright red). The frontend maps these to CSS classes.

**Session state:** Multi-round combat state (`req.session.combat`), forest depth (`req.session.forestDepth`), and rescue targets are stored in the Express session.

---

## Game Overview

- **12 levels** with 132 unique monsters (11 per level)
- **3 classes:** Death Knight, Mystic, Thief — each with a unique power move and class-specific interactions
- **Daily structure:** 10 forest fights and 5 PvP fights per day; HP heals overnight; bank pays 5% interest (capped at 10,000 gold/day)
- **Forest:** 30% chance of non-combat event (20 events including class-gated encounters); forest depth system for escalating challenge
- **Monster behaviors:** aggressive (double attack), defensive (damage reduction), venomous (poison), fleeing (escape when wounded)
- **Near-death system:** Fallen players can be rescued by other players before the next day
- **Endgame:** Reach level 12 and slay the Red Dragon to join the Hall of Kings

---

## Development

```bash
# Run with auto-reload
npm run dev

# Run tests (none yet — contributions welcome)
npm test
```

The `docker-compose.yml` exposes the app on port `3001` (maps to internal `3000`) and persists Postgres data in a named volume `pgdata`.
