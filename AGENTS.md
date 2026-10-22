# Official repository
- Primary repository: https://github.com/aaryamehta622-alt/Stick-Slam-Jam-REAL-.
- Use this checkout and its `main` branch for future development. Release ZIPs are snapshots, not the working source of truth.
- Keep frontend source at the repository root and the multiplayer application in `server/`. The server imports the shared engine from `src/game/`, so Render's Root Directory must remain blank.
- Never commit `node_modules`, generated `dist` directories, real environment files, credentials or private keys.

# Architecture
- Keep move effects in dedicated presentation modules driven by accepted combat actions; rendering must never alter damage, cooldowns or hit detection.
- Use procedural canvas geometry for combat VFX so effects remain animated and consistent with the pixel-art renderer.
