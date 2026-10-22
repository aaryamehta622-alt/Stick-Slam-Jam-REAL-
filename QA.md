# Version 1.3.0 verification — October 21, 2026

The existing engine was extended in place. The release preserves its original roster/boss combat, authored VFX, pixel rendering, shop, save keys and offline rewards. Fisherman is added as a ninth starter.

## Automated checks completed

- Frontend TypeScript check and production build pass.
- **97 tests across nine files pass.** They include the existing progression, purchase/reward journal, collision and pixel/VFX regressions; Fisherman's weighted distribution, hook hit/miss/block/release, all five fish swings, limited poison, electrical stun, giant knockback, ten-second expiry, pickup/throw consumption, healing/clamping/interruption, fixed warning/hit/escape for the creature; and network serialization/input validation/presentation immutability.
- The authored-geometry regression now includes the Fisherman liquid/line/fish/creature renderer at buildup, warning, emergence and recovery, checks finite coordinates/opacity and balanced canvas state, and verifies rendering never changes combat state.
- Backend TypeScript check and bundle pass. An isolated build with **server dependencies only**, without frontend node_modules, passes using the exact Render install/build commands.
- **10 Node integration tests (one parent and nine scenarios) pass** against an actual Colyseus server with two independent SDK clients. Verified custom codes, duplicates/invalid/full/missing rooms, selection/ready reset/host start/countdown, real hook/pull/punch damage/cooldowns, identical server fish rolls, item drop/pickup/throw, malformed/fake/duplicate actions, expiring movement input leases, victory, two-vote rematch, fresh input sequences after rematch/reconnect, reserved-session reconnect, all four Fisherman abilities, intentional guest forfeit and host room closure.
- That integration suite also passes with **100 ms simulated round-trip latency** under Node 22. This is a synthetic test, not an internet deployment claim.
- A build with an example HTTPS backend generates both its exact HTTPS and WSS CSP origins. The final delivered build has no backend URL and retains connect-src self; its setup notice was checked in the production client.

## Browser checks completed

Independent IAB browser tabs connected to the actual local Node 22 service. Both the Vite development client and optimized production client were exercised.

- Created APPLE, joined with apple, selected independently, readied both players and started a shared countdown. A separately generated six-character code also worked.
- Both browsers showed the same hook result and health (Fisherman 110, Samurai 94). The refreshed guest returned to its existing slot, moved and attacked; the host took real damage. The creature changed the remote Samurai from 94 to 58 in both browsers; Fresh Catch clamped the host from 105 to 110 in both.
- Intentional guest leave produced YOU WIN / forfeit for the host; Return to Lobby restored selection. Intentional host leave closed the room. No stale disconnected control continued.
- The production bundle with a local configured backend connected two players and showed the same hook damage (110 / 89). No production browser console errors were observed.
- At 390 × 844, entry/lobby/arena stayed within the screen. A discovered aspect-ratio overflow and pickup/movement overlap were fixed. All touch controls, including pickup, were visible. Clicking the touch hook button damaged the independent peer from 110 to 89.
- Fisherman's actual procedural creature emergence was inspected and captured from the live Ability Showcase. No physical water object or changed floor collision is used. Existing offline fighter selection and an actual Fisherman versus-AI encounter were exercised in the final build; no offline reward was claimed. The prior selected Mage was restored afterward.
- The same local origin retained its existing coins/XP and selected fighter through development/production swaps and reloads. The automated save suite covers purchased ownership, cosmetics, import/export, migration and failed-storage behavior. No new coin fixture was imported for this update.

Screenshots and browser-checks JSON accompany the release archives. Desktop in-game counters commonly displayed about 80–144 FPS here, including the creature effect. These are indicative counters, not a standardized benchmark or a guarantee for other devices.

## Practical limits and remaining verification

The original version 1.3.0 release was verified locally before GitHub publication. Its complete source now lives in the official `aaryamehta622-alt/Stick-Slam-Jam-REAL-` repository. No Render service creation, paid hosting purchase or Netlify production update was performed. Different-device/different-network HTTPS/WSS play must be checked after following MULTIPLAYER-DEPLOY.md. Physical simultaneous multi-touch, Safari/Firefox, packet loss and large-room-load testing remain unverified.

There are no secure player accounts/cloud saves or permanent online rewards. All classes are explicitly guest picks online; client-reported ownership is not trusted. Existing offline cosmetic equipment remains local; online uses class appearances. Rooms are in memory, limited to one server instance, pause for a 20-second reconnect window, expire after 15 minutes without activity, and end on backend restart.

Backend dependency installation reported zero advisories. The inherited frontend tool/style/router dependency tree still has npm advisories; this update did not apply unrelated breaking package upgrades. The new Colyseus SDK was not listed in the production audit. The existing >500 kB main-chunk and old Browserslist-data warnings remain nonfatal.

## Historical 1.2.0 verification

The following notes describe the preceding release, not additional tests newly performed for 1.3.0.

# Verification — major update 1.2.0

Verified locally October 18, 2026 (America/New_York). This update modifies the existing game; it does not rebuild or replace combat.

## Automated checks

`npm run typecheck`, `npm test` and `npm run build` succeed. The final suite has **79 tests across seven files**.

- 22 progression/shop tests cover v1 migration, 1,000 coins earned through 20 Giant Brute reward transactions, the 5,000 → 3,000 Ninja purchase, atomic debits/unlocks, insufficient funds, rejected IDs/prices, duplicate/concurrent clicks, unchanged boss probabilities, duplicate-class bonuses, one-time win claims, recovery journals, failed writes and retries, corrupted-record recovery, timestamps, future-schema protection, old-tab writes, backup merging, equipment, selected class, preferences and settings.
- Three hybrid-rendering tests check every fighter's visual joint poses without moving hit points or mutating combat, continuous jump height, nearest-neighbor actor composition, and independent pixel intensity at Low/High effects quality.
- The existing 54 combat/VFX tests remain. They cover all 22 fighters, Elementalist variants, heavies, finite geometry, cooldowns, phase changes, accepted events, pooling, hitstop, input buffering, block direction, projectile attribution and more. Render regressions include 480 whole-engine mocked renders and 1,344 dedicated special-effect renders.
- SHA-256 comparison against the preceding VFX release confirms **16 combat/VFX source modules are byte-for-byte unchanged**: engine, abilities, types, classes, stick kinematics, particles, presentation, effect types/interface, all six dedicated VFX modules, and audio. New rendering layers compose around these effects. The dependency lock differs only in the two root release-version fields.

Mocks verify commands/state, not artistic quality or device speed. Browser visual checks supplement them. No new runtime dependency was added. The preceding release verified a clean npm installation; this release reused that dependency set. Remote Node 22 CI has not been run from this workspace.

## Browser checks

Used in-app Chromium against the development and final production builds:

- Opened the Class Shop from the main menu. Verified all six prices, source bosses/chances, disabled insufficient-funds buttons, inspection details and the live ability-preview link.
- Imported a controlled legacy 1,000-coin QA fixture on the isolated `localhost` origin. Refreshed, closed the tab, reopened the same address and verified 1,000 remained.
- Imported a 5,000-coin fixture, checked the 2,000 Ninja confirmation and 3,000 remainder, cancelled once without spending, then confirmed. Ninja immediately became owned, its Buy option disappeared, and Play This Class selected it in the roster.
- Closed/reopened the tab and verified Ninja ownership and the 3,000 balance. Checked retained cosmetics, selected Ninja and saved Strong/Medium graphics preferences. These are fixture-based persistence checks; automated tests separately exercised actual reward earnings and class drops.
- Switched the same local address from the dev server to the built production server, then reloaded. Ownership and 3,000 coins remained. This tests build compatibility on the same origin; it is not an upload to the live Netlify account.
- Exercised all **120** production cast combinations: every fighter/boss's four slots and fully charged heavy, including all three Elementalist styles. Previewed Subtle, Moderate and Strong character pixelation and High/Low effects detail. Representative modern effects were visually inspected alongside pixel characters. The original effect modules were preserved.
- Exercised a normal Mage/Giant Brute encounter, keyboard abilities, heavy release and pause. The boss reward paths were tested automatically; a live boss victory is not claimed from this short encounter.
- Checked the shop and inspection dialog at a 390×844 viewport with no horizontal overflow. The prior release also verified the responsive touch dock and pointer controls; physical hardware and simultaneous multi-touch remain untested.

No production console errors were observed during the final roster smoke checks. Browser results are saved in `stick-slam-jam-major-update-browser-checks.json`. Actual unedited production screenshots are provided beside the release archives. Desktop runs displayed roughly 120–144 FPS here; that is an indicative in-game counter, not a standardized benchmark or a guarantee for other devices.

## Build and packaging

The production output includes the static index, CSS, hashed application/showcase/shop chunks, favicon, robots file, response headers and SPA redirects. The source archive excludes `node_modules`, `dist` and Git metadata. The complete `dist/` is also copied into the output folder for manual upload. Website archive entries and the copied folder are checked against the final build using SHA-256.

The main JS chunk is approximately 508 kB (161 kB gzip), shop 32 kB (12 kB gzip), showcase 7 kB (3 kB gzip), and CSS 89 kB (17 kB gzip). No remote art, font or audio download is needed. Vite emits non-fatal notices about an old Browserslist dataset and the main chunk slightly exceeding its 500 kB advisory threshold. The build exits successfully.

`NETLIFY-UPDATE.md` covers updating the existing project and keeping the same primary origin. No new Netlify site, paid plan, account, DNS change or public deployment was performed. Supabase is documented only as a future proposal; no cloud-saving functionality is claimed.

## Practical limits

- Saves are local to the browser/profile and origin. They cannot survive deliberate storage clearing, private-session teardown or unavailable storage without a backup. Failed persistence is reported rather than silently treated as success.
- Web Locks serialize cross-tab writes in supporting browsers; the fallback retains single-tab serialization and whole-record atomic writes. Browser-local progress is user-editable, not an authoritative online economy.
- Past boss-win counts were never stored and cannot be reconstructed. Their previously earned rewards/unlocks remain intact.
- Actual Netlify deployment behavior, a full browser-process restart, Safari/Firefox, physical Android/iPhone multi-touch and slower-device performance have not been verified here.
- Price fairness uses the existing reward economy and difficulty data; longer real-player timing and balance studies remain future tuning work.
