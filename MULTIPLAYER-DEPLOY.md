# Publish Fisherman + online multiplayer to your existing website

Version 1.3.0. Your website stays on Netlify. The new Node 22 / Colyseus 0.18 server runs on Render. No account system or database is required for private matches.

## 1. Use the official GitHub repository

The primary repository is [aaryamehta622-alt/Stick-Slam-Jam-REAL-](https://github.com/aaryamehta622-alt/Stick-Slam-Jam-REAL-), branch `main`. The full version 1.3.0 source is extracted directly at its root, including `server/package.json`, `server/src/`, and the shared `src/game/` engine. There is no ZIP extraction step in Render.

To make another local checkout:

```powershell
git clone --branch main https://github.com/aaryamehta622-alt/Stick-Slam-Jam-REAL-.git
cd Stick-Slam-Jam-REAL-
```

For future updates, commit source/configuration changes and both lockfiles when dependencies change. Do not commit `node_modules`, `dist`, `server/dist`, or real `.env` files. Both lockfiles are already tracked.

From the **repository root** after making future changes:

```powershell
git status
git add src public server package.json package-lock.json vite.config.ts .gitignore .env.example render.yaml .github/workflows/verify.yml AGENTS.md README.md QA.md NETLIFY-UPDATE.md MULTIPLAYER-DEPLOY.md
git diff --cached --stat
git commit -m "Describe your game update"
git push origin main
```

Review `git status` and the staged file list before committing if you already have unrelated changes. Keep the existing Git history; do not initialize a replacement repository or force-push.

## 2. Create the Render backend

Open the [Render dashboard](https://dashboard.render.com/), choose **New → Web Service**, connect GitHub if needed, and select **aaryamehta622-alt/Stick-Slam-Jam-REAL-**, branch **main**. Use these exact settings:

| Render setting | Value |
| --- | --- |
| Name | A name you choose, such as `stick-slam-jam-multiplayer` |
| Language/runtime | Node |
| Region | Close to both players |
| Root Directory | **Leave blank** |
| Build Command | `npm --prefix server ci --include=dev && npm --prefix server run build` |
| Start Command | `npm --prefix server start` |
| Health Check Path | `/health` |
| Instances | **1** |
| Instance type | Starter for regular play; Free is available for trying it with sleep/restart limitations |

Do **not** set Root Directory to `server`: the backend deliberately imports the existing shared engine from `src/game`.

Add these environment variables in Render:

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | Your exact existing website origin, for example `https://your-game.netlify.app` |

Use your real website address, without a trailing slash or page path. For a custom domain plus the Netlify domain, enter both separated by a comma. Add only the origins you actually want to allow. `PORT` is provided by Render; leave it alone. No private API key is needed. `server/.env.example` is a reference, not a file you must upload.

Click **Create Web Service**. After it reports Live, open `https://YOUR-SERVER.onrender.com/health`. It must return `{"ok":true,"service":"stick-slam-jam","protocol":1}`. Copy the **base HTTPS URL**, without `/health`.

An optional `render.yaml` Blueprint contains these same commands and asks for `ALLOWED_ORIGINS`. It selects the paid Starter plan; review that choice in your own account before creating a service. No paid service was created by this task.

Render supports public WebSockets and terminates TLS for HTTPS/WSS before forwarding to the app. Our server uses its provided port on `0.0.0.0`. [Render Web Services](https://render.com/docs/web-services), [WebSockets](https://render.com/docs/websocket).

Free services can sleep after inactivity, take time to wake, and restart. Rooms are held in memory, so a restart or deployment ends active rooms; players receive a connection message and can create a new room. A paid instance improves availability but does not make rooms persistent. Keep one instance: horizontal scaling would require a shared presence/code registry. [Render Free limitations](https://render.com/docs/free).

## 3. Connect your SAME Netlify website

Open your existing Netlify project. Under its environment-variable settings add:

```text
VITE_MULTIPLAYER_SERVER_URL=https://YOUR-SERVER.onrender.com
```

Use the Render URL you just copied. Give it the **Builds** scope and production context. Keep these existing build settings:

| Netlify setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node | `22` |

Deploy the pushed commit, or trigger a fresh production deploy after changing the variable. Vite embeds the public server URL **at build time**; changing it requires rebuilding. The build also generates a Content Security Policy allowing only that server's HTTPS and WSS origins. HTTPS pages use secure WebSockets automatically through the Colyseus SDK. [Netlify build variables](https://docs.netlify.com/build/configure-builds/environment-variables/).

Keep your existing site, primary domain, protocol, and browser profile so local saves remain at the same origin. Do not create a new Netlify site.

### If you use manual Netlify uploads

The supplied `stick-slam-jam-fisherman-online-website.zip` / `fisherman-online/dist` is a complete frontend build **without your unknown Render URL**. Fisherman and offline play work; Multiplayer displays the setup notice. Uploading that ZIP alone does not deploy a backend or enable online play.

After Render is Live, run these commands from the updated source folder with Node 22 installed:

```powershell
npm ci
$env:VITE_MULTIPLAYER_SERVER_URL='https://YOUR-SERVER.onrender.com'
npm run build
```

Upload this newly generated **dist folder** to the **Deploys** page of the existing Netlify project. The folder directly contains `index.html`, `assets/`, `_headers`, and `_redirects`. A manual upload does not run a build or inject Netlify environment variables into an already-built ZIP. [Manual deploys](https://docs.netlify.com/deploy/create-deploys/#drag-and-drop).

## 4. Play and verify from different devices

1. Both players visit your usual Netlify URL and choose **MULTIPLAYER**.
2. Host chooses **CREATE ROOM**, enters `APPLE` (or leaves the field blank), and opens the arena.
3. Friend chooses **JOIN ROOM** and enters `apple`. Both must see the same lobby.
4. Each chooses a fighter and clicks **I'M READY**. Host clicks **START MATCH**.
5. Check the shared countdown, movement, attacks and both health bars. Try Fisherman's hook, fish swing, E pickup, light throw, interrupted heal and sea creature.
6. Finish a round; both vote for Rematch. Try Return to Lobby and change fighters.
7. Refresh one player; the match pauses and the reserved seat can reconnect within 20 seconds. Confirm controls work afterward. Leaving intentionally forfeits for a guest or closes the room for the host.

Local tests used independent WebSocket clients and independent browser tabs. The GitHub source is prepared, but no live Render/Netlify deployment or different-network device test was performed. This final public-connection check remains after deployment through your hosting account.

## Saves and temporary online rules

Fisherman is a ninth starter class. Existing save keys, purchased unlocks, coins, XP, boss rewards, cosmetics, equipped class and graphics settings remain compatible. No inventory or achievement system was present to migrate.

**All 15 playable classes are guest picks in private online matches.** The lobby marks local ownership; guest picks do not unlock offline classes. Browser-local ownership cannot be verified securely, so no client ownership flags are trusted by the server. Online matches award **no currency, XP, class unlocks or items to your permanent save**. Match fish are temporary combat objects. Existing offline cosmetics and progression remain available in single-player; online fighters use their class appearance. Cloud saves and secure account ownership remain future work.

## Local development and troubleshooting

Use two terminals in the game folder:

```powershell
# Terminal 1: install/build/start the backend
npm --prefix server ci --include=dev
npm run server:build
npm run server:start
```

```powershell
# Terminal 2: frontend (development defaults to the localhost backend)
npm ci
npm run dev
```

Visit `http://127.0.0.1:8080`. For a different local frontend port, update the development `ALLOWED_ORIGINS`. `PLAY-LOCALLY.cmd` starts the frontend; online mode also needs the backend terminal above.

Run checks with `npm run typecheck`, `npm test`, `npm run server:build`, `npm run server:test`, and `npm run build`. The real two-client test launches its own temporary backend on port 2568 and closes it afterward. No hidden damage, winner, RNG or ownership test endpoint is shipped.

- **Setup notice:** the production build did not receive `VITE_MULTIPLAYER_SERVER_URL`; set it and rebuild.
- **Cannot reach server:** visit `/health`, check Render logs/status, and allow a sleeping service to wake.
- **Origin blocked:** match `ALLOWED_ORIGINS` exactly to the address in the browser, including `https://` and any `www`.
- **CSP/WebSocket blocked:** rebuild with the real server URL and upload the new `_headers` with the rest of `dist`.
- **Room not found after a deploy:** server restarts clear rooms. Host creates a new code.
- **Room full:** two seats are already occupied/reserved or a round is in progress; wait or create another room.
- **Saves appear empty:** check the original domain/profile. Preview domains and different devices have separate local storage. Use the existing export/import tools if moving a save.
