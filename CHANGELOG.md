# Changelog

## [Unreleased]

### Combat System
- **Monster behavior types** — Monsters now have distinct fighting styles:
  - *Aggressive* (Rabid Dog, Wild Boar, Werewolf, Minotaur, Chimera, Blood Elemental) — attacks twice per round
  - *Defensive* (all Golems, Gargoyle) — absorbs 20% of incoming damage
  - *Venomous* (Dark Fairy, Giant Spider, Slime Monster, Manticore, Wyvern, Vampire Bat, Basilisk) — 35% chance to apply poison on hit
  - *Fleeing* (Lost Beggar, Imp, Bandit, Harpy, Forest Sprite) — 40% chance to flee when HP drops below 30%
- **Poison status effect** — Venomous monsters can poison players (3 rounds); poison deals 5% max HP per combat round; wears off overnight; armor with `poison_resist` has a 50% chance to block it
- **Improved flee formula** — Base 45% flee chance; +15% for Thieves; +15% when HP is below 20%; scaled down by monster strength
- **Improved defense formula** — Replaced flat reduction with percentage mitigation capped at 75%, giving armor better scaling at all levels
- **Power moves consume skill uses** — Using a power move now costs 1 `skill_uses_left` (already tracked in daily resets)
- **Death Knight Rage** — New `[D]` combat option: spend 15% max HP to double damage on next strike; activates a rage indicator on screen

### Equipment
- **Tier choice system** — Weapons and armors now have a `tier` field; 4 alternative weapons (Hunting Spear, War Mace, Battlehammer, Twin Daggers) and 4 alternative armors (Scale Mail, Padded Armour, Studded Leather, Battle Plate) added at tiers 3–6
- **Equipment bonuses** — Alternative items carry special effects:
  - Weapons: `flee_bonus`, `stun`, `armor_pierce`, `double_strike`
  - Armors: `poison_resist`, `regen`, `evasion`, `thorns`
- **Bonus effects applied in combat** — Double strike, stun, evasion, regen, thorns, and poison resist all fire during forest combat rounds

### Class-Specific Content
- **Thief shop interactions** — Thieves can attempt to "Acquire" an item at weapon/armor shops (20% success → free next-tier item; 80% caught → 20% HP penalty)
- **Mystic inn discount** — Mystics pay 10% less for inn rest
- **Death Knight tavern intimidation** — Death Knights can attempt to intimidate a player for 15% of their gold (no full combat; success scales with strength difference)
- **Class-gated forest events** — Three new events exclusive to each class: Smuggler's Cache (Thief), Mage Tower Ruins (Mystic), Dark Altar (Death Knight)

### Forest System
- **Forest depth system** — After winning a fight, players can "Go Deeper"; each depth level increases monster strength/HP/loot by 15%; depth resets on death or return to town
- **10 new forest events** (now 20 total) — Wandering Merchant, Mushroom Ring, Talking Skull, River Crossing, Ancient Map, Smuggler's Cache (Thief), Mage Tower Ruins (Mystic), Dark Altar (Death Knight), Storm Warning, Wounded Knight
- **Poison events** — Some forest event outcomes can apply poison (e.g., risky mushroom)
- **Two-step quest system** — The Wounded Knight encounter starts a quest; completing it by visiting the Inn or Master rewards gold, exp, and charm

### Economy & Daily Reset
- **Bank interest capped at 10,000 gold/day** — Prevents passive wealth snowballing at high bank balances
- **Marriage charm bonus** — Married players gain +1 charm per day (capped at 50)
- **Kids have a gold cost** — Each child costs 20 gold/day; if funds run out, one child leaves home
- **Bank interest now shows in daily reset messages**

### Multiplayer & Social
- **Near-death news announcement** — A news item appears when a player falls near-death (already implemented; now confirmed in place)
- **Town Crier** — Players can post a 60-character announcement to the news feed for 50 gold (`[Y]` from the town menu)
- **Legend status** — Players who slay the Red Dragon earn `is_legend` status; shown in character screen and Hall of Kings (3+ wins displays `★ LEGEND`)

### Visual & UX
- **Poison indicator** — Status bar and character screen show poison status when active
- **Forest depth indicator** — Current depth shown on combat screen during deep runs
- **Rage indicator** — Rage-active state displayed on encounter screen
- **Equipment bonus display** — Shop screens show bonus descriptions for alternative tier items; alternatives marked with ★
- **Mystic discount display** — Inn screen notes the 10% discount for Mystic class
- **Death Knight intimidate display** — Tavern shows the intimidate option for Death Knights

### Infrastructure (Dockerfile)
- Pinned base image to `node:22.14-alpine3.21`
- Non-root `app` user added; container runs without root privileges
- `npm install` replaced with `npm ci --omit=dev` for reproducible builds
- Added `HEALTHCHECK` using `wget`
- `.dockerignore` expanded to exclude `npm-debug.log`, `*.md`, and generator scripts

---

## Earlier Work

### ASCII Art & Banners
- Added location banners for all 12 game locations (town, forest, weapon shop, armor shop, inn, bank, master, tavern, garden, bard, dragon, news) in classic BBS/ANSI style
- Added monster ASCII art for 15 creature types, pattern-matched by monster name
- Added HP bars using Unicode block characters with color-coded health levels

### Combat Improvements
- Added critical hits: 8% player chance (2.2× damage), 5% monster chance (1.8× damage)
- Added round counter and combat history display (previous rounds shown dimmed)
- Power move names displayed per class

### Forest Events (original 10)
- Hermit Riddle, Glittering Chest, Wounded Traveller, Healing Pool, Forest Shrine, Lost Wanderer, Witch's Bargain, Abandoned Camp, Raven Omen, Bandit Toll

### Near-Death & Rescue System
- Players reduced to 0 HP have a 20% chance of NPC rescue (instant), 25% chance of near-death state (other players can rescue), 55% chance of death
- Near-death players appear to other forest entrants with a rescue prompt
- Rescuers gain exp (75 × victim level) and +1 charm
- Unrescued near-death players die at daily reset

### Expanded Monster Roster
- 132 monsters across 12 levels (11 per level) with unique meet/death flavor text
