# Stick Slam Jam — version 1.3.0

Official primary repository: [aaryamehta622-alt/Stick-Slam-Jam-REAL-](https://github.com/aaryamehta622-alt/Stick-Slam-Jam-REAL-), branch `main`. The complete project is tracked directly here: frontend in `src/`, multiplayer backend in `server/`, and shared combat in `src/game/`.

The existing browser fighter, updated in place: 15 playable classes, eight bosses, three arenas, combos, charged heavies, all 92 special ability slots, cosmetic drops, earned coins and XP. Offline play needs no backend or external asset download. Private online play uses the included Colyseus backend on Render.

## Play locally

Use Node.js 22 LTS. On Windows, run `PLAY-LOCALLY.cmd`, or open a terminal in this source folder:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL Vite prints, normally `http://127.0.0.1:8080`.

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

The production site is the complete `dist/` folder. Serve it over HTTP; opening its HTML as a local file does not support JavaScript modules.

## Online deployment

Start with **[MULTIPLAYER-DEPLOY.md](MULTIPLAYER-DEPLOY.md)** for exact GitHub, Render and existing-Netlify steps. Deploy the backend first, set `VITE_MULTIPLAYER_SERVER_URL` in Netlify, then rebuild the frontend. The shipped frontend without that URL shows a clear setup notice; a frontend ZIP alone cannot provide online rooms.

For local online play, use a second terminal:

```sh
npm --prefix server ci --include=dev
npm run server:build
npm run server:start
```

The development client defaults to `http://127.0.0.1:2567`; production never defaults to localhost. All 15 classes are guest picks online, with no permanent online rewards. Local ownership and saves remain unchanged.

## What changed

- **Fisherman:** a ninth starter, fishing rod, hook/reel/punch, five weighted fish, bounded poison and electric stun, ten-second dropped items, E/touch pickup and light-attack throw, interruptible healing, and a fixed, dodgeable sea-creature eruption. The floor refracts/ripples procedurally without changing arena collision.
- **Private online 1v1:** custom 4–12-character case-insensitive codes, two-player lobby, independent class selection, host arena/start, readiness, synchronized countdown, results, two-vote rematches, lobby return, 20-second reconnect grace, forfeit and cleanup. The server runs this same engine at 120 Hz, streams 30 Hz snapshots and compact accepted-cast/impact events, and accepts validated input only. Clients interpolate and predict locomotion while the server owns every hit, cooldown, item and random roll.

- **Reliable local saves:** original keys retained; versioned records, migration, last-good recovery, winning-frame reward journals, atomic purchase records, autosave retries, clear save status and validated backup import/export.
- **Class Shop:** available from the main menu at `/shop`. Inspect a class and its four abilities, review a price confirmation, then unlock it with earned coins. Boss drops still grant the same ownership and use the original probabilities.
- **Hybrid art:** outlined, moderately pixelated characters and stepped scenery sit beneath the existing display-resolution anime VFX. Pixel intensity has Subtle, Moderate (default), and Strong options. Quality changes particle/detail budgets, not the character-pixel setting. Combat mechanics and hit detection do not use the visual pose sampling.
- **Progress retained:** coins earned/spent, ownership, purchases, XP, equipment, selected class, boss-win counts and arena/alternate-weapon/touch preferences save automatically. Graphics/audio preferences save too. Existing rewards are preserved; historic boss counts cannot be reconstructed because older versions never recorded them.
- **Ability Showcase:** `/showcase` previews all 23 fighters, including locked classes, with pause, frame step, slow motion, arenas, quality, pixel intensity and all three Elementalist elements. It does not grant rewards or change progression.

## Class prices

| Class | Coins |
|---|---:|
| Ninja | 2,000 |
| Sniper | 2,200 |
| Gladiator | 2,400 |
| Assassin | 2,500 |
| Executioner | 3,500 |
| Elementalist | 7,200 |

The eight existing starter classes stay free, and Fisherman joins them as the ninth. Prices derive from the actual boss difficulty, drop chance and coin payout, anchored to Ninja at exactly 2,000. See `SAVE-SYSTEM.md` for the audit, formula and earning comparisons. A duplicate purchased-class boss drop still awards the original 50-coin bonus.

## Saving and backups

Progress saves in this browser on this website. Normal refreshes and tab/browser restarts keep it. Clearing site storage, private browsing, browser eviction, another browser/device, or a different website origin can remove or separate local progress. Export a backup from fighter selection or the shop to keep a copy or transfer manually.

The deployed key remains `stickfight-progress-v1`; the new record schema is version 2. The audio/graphics key remains `stick-slam-settings-v1`. Old saves and version 1 backups migrate safely. Importing an old backup merges ownership and keeps spending receipts, so it cannot refund a recorded class purchase. Invalid records are preserved and recovered from the last-good mirror when possible.

A warning means the browser has not accepted a save. Allow site storage, use Retry, or export the pending progress before leaving. A failed purchase does not spend coins. See `SAVE-SYSTEM.md` for the storage and transaction behavior.

**Cloud saving is not connected.** `FUTURE-CLOUD-SAVES.md` describes the proposed Supabase account/backend work, security boundaries and tests required before cross-device sync can be claimed.

## Update your existing Netlify site

Use the complete updated `dist/` folder or extract `stick-slam-jam-fisherman-online-website.zip`. Upload that built folder through your existing project's Deploys workflow; keep the project and primary URL unchanged. For a Git-connected project, update its connected source using the retained Netlify build configuration.

Follow `MULTIPLAYER-DEPLOY.md` for the backend URL and rebuild, then `NETLIFY-UPDATE.md`. No new Netlify website was created and no public deployment was performed in this task. Same-origin development-to-production save compatibility is covered in local verification; check the actual published address after your upload.

## Controls

| Action | Desktop |
|---|---|
| Move | A/D or left/right arrows |
| Jump | W, up arrow or Space |
| Light combo | Left mouse or J; tap to chain |
| Charged heavy | Hold right mouse or K; release to fire |
| Four abilities | 1–4 or numpad 1–4 |
| Dash | Shift or L |
| Block | F, S or down arrow |
| Pick up nearby fish | E (Fisherman) |
| Offline pause / rematch / menu | P / R / Escape |
| Online rematch / lobby / leave | On-screen room controls |

Touch controls remain available on narrow screens; the Touch button also enables them on desktop. Mute, reduced motion, effects quality and character pixelation are available in the menu settings. Reduced motion disables shake, flashes and camera pushes, and stops the landing demo. Quality budgets are High 720, Medium 360 and Low 160 pooled particles, with bounded legacy dust separately.

## Architecture

- `progress.ts`, `rewards.ts`, `reward-catalog.ts`, `shop.ts`: durable progression, exact original reward data and class transactions.
- `pixel-art.ts`: isolated actor/scenery layers and visual-only pose sampling. `stick.ts` continues to provide exact combat joint kinematics.
- `particles.ts`, `presentation.ts`, `vfx/`: preserved bounded effects, authored move designs, projectiles, areas, hit choreography, charge and cinematic lighting.
- `engine.ts`, `abilities.ts`, `types.ts`: existing 120 Hz combat simulation. The presentation layer does not change damage, cooldowns, hitboxes or progression.
- `ClassShop.tsx`, `Showcase.tsx`, `SaveStatus.tsx`, `SaveTools.tsx`: real game interfaces and save feedback.

See `QA.md` and the release manifest for verification scope and remaining device/public-deployment checks. CI runs frontend checks/build, backend build and the two-client integration test on Node 22.
