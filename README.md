# Scales of Tears

A browser-based RPG inspired by *Legend of the Red Dragon*, reimagined for the modern web. Built with Node.js/Express and PostgreSQL, featuring a retro ASCII art aesthetic, color-coded terminal output, and a daily-play structure.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/rehatiel/Scales_of_Tears.git
cd Scales_of_Tears/lord-web
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Open `.env` and set the following:

| Variable | Description |
|---|---|
| `SESSION_SECRET` | **Required.** A long, random string used to sign session cookies. Change this before running. |
| `ADMIN_PASSWORD` | **Required.** Password for the admin panel at `/admin.html`. Change this before running. |
| `DATABASE_URL` | PostgreSQL connection string. The default works with Docker Compose — change it only if you're connecting to an external database. |
| `PORT` | Port the app listens on. Defaults to `3001`. |
| `NODE_ENV` | Set to `production` for a live server. |

### 3. Deploy with Docker Compose

```bash
docker compose up --build
```

The game will be available at `http://localhost:3001`.

Docker Compose starts both the app and a PostgreSQL database. The database schema and all migrations are applied automatically on first startup. Postgres data is persisted in a named volume (`pgdata`) so your world survives restarts.

---

## Environment Variables Reference

```
SESSION_SECRET=some-long-random-string-here
ADMIN_PASSWORD=a-strong-admin-password
DATABASE_URL=postgresql://sot:sotpass@localhost:5432/sotdb
PORT=3001
NODE_ENV=production
```

---

## Architecture

```
lord-web/
├── server.js          — Express app entry point, session config
├── db.js              — PostgreSQL pool, schema, all DB functions
├── migrations/        — SQL migration files applied in order on startup
├── routes/
│   ├── auth.js        — Login / register
│   └── game.js        — All game actions (POST /api/game/action)
├── game/
│   ├── engine.js      — Screen generation, ASCII banners, HP bars
│   ├── combat.js      — Round resolution, monster AI, flee formula
│   ├── data.js        — Static data: weapons, armors, 132 monsters
│   ├── forest_events.js — Non-combat forest encounters + monster art
│   └── newday.js      — Daily reset routine (HP, bank interest, etc.)
└── public/            — Frontend (HTML/CSS/JS, vanilla)
```

**Action flow:** Every player interaction is a `POST /api/game/action` with `{ action, param }`. The route handler reads player state from DB, processes the action, writes changes, and returns a `{ title, lines[], choices[] }` screen object that the frontend renders.

**Color codes:** Lines use backtick color codes inherited from the classic BBS ANSI color system (e.g. `` `$ `` = bright yellow, `` `@ `` = bright red). The frontend maps these to CSS classes.

**Session state:** Multi-round combat state (`req.session.combat`), forest depth, and rescue targets are stored in the Express session, backed by PostgreSQL via `connect-pg-simple`.

---

## Game Overview

- **12 levels** with 132 unique monsters (11 per level)
- **10 classes:** Dread Knight, Warrior, Rogue, Mage, Ranger, Paladin, Druid, Necromancer, Elementalist, Monk — each with unique stats, a power move, and class-specific interactions
- **Daily structure:** Stamina-gated forest and wilderness fights; HP heals overnight; bank pays 5% daily interest
- **World map:** 13 towns connected by travel routes, each with unique wilderness zones, shops, and social spaces
- **Endgame:** Reach level 12, slay the Red Dragon, then Ascend (Prestige) to start again harder
- **Living world:** Rotating world events, named enemy invasions, monster population depletion, wilderness infestations
- **Admin panel:** Available at `/admin.html` — player management, announcements, migration runner, backup/restore
