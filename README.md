# Scales of Tears

A browser-based RPG inspired by *Legend of the Red Dragon*, reimagined for the modern web. Built with Node.js/Express and PostgreSQL, featuring a retro ASCII terminal aesthetic, real-time notifications, and a living world that persists between sessions.

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
│   ├── auth.js        — Login / register / account management
│   └── game.js        — All game actions (POST /api/game/action), SSE stream
├── game/
│   ├── engine.js      — Screen generation, ASCII banners, HP bars
│   ├── combat.js      — Round resolution, monster AI, flee formula
│   ├── data.js        — In-memory game data cache (weapons, armors, monsters, exp table); populated from DB at startup
│   ├── forest_events.js — Non-combat forest encounters + monster art
│   ├── newday.js      — Daily reset routine (HP, bank interest, etc.)
│   ├── secrets.js     — 18 hidden one-time secrets with trigger/weight system
│   ├── sse.js         — Server-Sent Events registry (push screens and toasts to players)
│   ├── quests.js      — Quest cache (QUEST_DEFINITIONS); populated from DB at startup
│   ├── quest_runner.js — Generic executor for DB-driven quests (kill triggers, travel triggers, choice resolution)
│   ├── factions.js    — Faction reputation helpers
│   ├── wounds.js      — Wound and infection parsing/display
│   └── handlers/      — Action handlers split by domain (forest, tavern, combat, characters, …)
└── public/            — Frontend (HTML/CSS/JS, vanilla)
```

**Action flow:** Every player interaction is a `POST /api/game/action` with `{ action, param }`. The route handler reads player state from DB, processes the action, writes changes, and returns a `{ title, lines[], choices[] }` screen object that the frontend renders.

**Real-time events:** A persistent `GET /api/game/stream` SSE connection pushes screens and toast notifications to the client without polling — used for PvP results, incoming mail, bounties, and arena challenges.

**Color codes:** Lines use backtick color codes inherited from the classic BBS ANSI color system (e.g. `` `$ `` = bright yellow, `` `@ `` = bright red). The frontend maps these to CSS classes.

**Session state:** Multi-round combat state (`req.session.combat`), forest depth, and rescue targets are stored in the Express session, backed by PostgreSQL via `connect-pg-simple`. Sessions carry both `accountId` and `playerId` to support multi-character accounts.

---

## Game Overview

### Core
- **12 levels** with 132 unique monsters (11 per level)
- **10 classes:** Dread Knight, Warrior, Rogue, Mage, Ranger, Paladin, Druid, Necromancer, Elementalist, Monk — each with unique stats, a signature power move, perks, and a level-6 specialisation path
- **Daily structure:** Stamina-gated forest and wilderness fights; HP heals overnight; bank pays 5% daily interest
- **World map:** 13 towns connected by travel routes, each with unique wilderness zones, dungeons, ruins, shops, and social spaces

### Character System
- **Multiple characters per account** — up to 3 characters per login, switchable in-game without re-authenticating
- **Perk system** — earn a perk point every 3 levels; choose from a class-flavoured list that shapes your playstyle
- **Skill trees** — pick a specialisation path at level 6 (e.g. Warrior → Guardian or Champion)
- **Hidden builds** — Vampire (unlocked through infection), Blessed, and Cursed paths discoverable through play
- **Deed titles** — Dragonslayer, Widowmaker, Undying, Shadow, Warden's Champion; NPCs react to your reputation

### Wounds, Infection & Recovery
- Combat leaves wound types (slash, crush, bite) that persist and worsen if untreated
- Infections: Rot, Rabies, and Vampire curse — each with unique overnight progression
- Inn healer, herbalist remedies, and faction healers provide treatment options

### Social & PvP
- **Tavern social system** — inspect, mail, bounty board, arena challenges, and buy-a-round
- **Real-time notifications via Server-Sent Events** — mail, bounties, and arena challenges arrive as toast notifications without interrupting gameplay
- **Arena duels** at Silverkeep and Ironhold with spectator betting
- **Revenge bonus** — extra EXP for killing the player who last killed you

### Factions & Reputation
- 5 factions with independent reputation scores per character
- Shopkeeper allegiance, faction meeting houses, assassin spawns, and safe houses
- Faction standing affects available quests, NPC reactions, and town access

### Quests & Story
- **Database-driven quest framework** — quests and their steps are stored in PostgreSQL and loaded into memory at startup; new quests with `kill_named`, `travel`, `choice`, `npc_talk`, `kill_boss`, and `event_trigger` step types can be added from the admin panel with no code changes
- *The Warden's Fall* — 6-step post-dragon questline culminating in a Veilborn boss fight
- Unlisted quests, secret lore fragments, and one-time story events discoverable through exploration
- **18 hidden secrets** — rare, unrepeatable moments scattered across forest, inn, bank, tavern, and town

### Living World
- Rotating world events (plague, war, invasions, magical storms) announced via Daily News
- Named enemy system — named monsters persist, level up on player kills, and appear in the news
- Monster population depletion: over-farm wolves and they stop spawning
- **Weekly Hunt Board** — 5-tier bounty list with leaderboard prizes and a Hunter title

### Endgame
- Slay the Red Dragon at level 12, then Ascend (Prestige) to start again with a permanent bonus
- Champion dragon fights — progressively harder ancient variants
- Post-dragon questline opens a new layer of story

### Admin
- Admin panel at `/admin.html` — player management, ban system, announcements, migration runner, one-time impersonation tokens
- **Game Data editor** — live-edit weapons, armors, monsters, and game constants (exp thresholds, dragon stats, daily limits, etc.) directly from the browser; changes take effect immediately without a restart
- **Quest builder** — create and edit quests with an ordered step editor; each step type reveals type-specific fields (destination town, NPC ID, boss ID, choice prompt with per-option effects and outcome text); active player count shown before deletion
