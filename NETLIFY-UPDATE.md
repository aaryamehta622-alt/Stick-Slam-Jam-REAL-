# Update the existing Netlify website

This release is prepared for the Netlify project you already use. No new website, project name, domain or account was created. The complete production folder is `dist/`; the website ZIP contains its contents with `index.html` at the root.

## Online multiplayer requires the Render backend

Follow **[MULTIPLAYER-DEPLOY.md](MULTIPLAYER-DEPLOY.md)** first. Deploy `server/` using the game root as Render's build root, set the real `VITE_MULTIPLAYER_SERVER_URL` in Netlify, and trigger a fresh build. The build generates the correct HTTPS/WSS Content Security Policy. The prebuilt website ZIP has no Render URL because none was supplied, so its online screen honestly reports that setup is needed. Single-player and Fisherman still work.

For manual uploads, rebuild locally with your Render URL before uploading; an already-built ZIP cannot receive build-time variables from Netlify.

## Manual deployment

1. Export a progress backup from your current game before the update.
2. Extract the website ZIP. Check that the folder you will upload directly contains `index.html`, `assets/`, `_headers` and `_redirects`.
3. Sign into Netlify and open your **existing Stick Slam Jam project**.
4. Open its **Deploys** page and use the manual deploy/drop area to upload the extracted build folder.
5. Publish that deploy to production, then visit your existing primary website address.

Manual deployments upload an already-built folder; Netlify does not run a build for that upload. [Netlify deployment documentation](https://docs.netlify.com/deploy/create-deploys/#drag-and-drop)

For your existing Git-connected deployment, update its source and keep `npm run build`, publish directory `dist`, and Node 22. The existing `netlify.toml` declares those settings. Upload the built website folder for a manual deployment; the source ZIP is for development.

## Keep the same browser-save origin

Our code retains `stickfight-progress-v1` and `stick-slam-settings-v1`. It migrates old records in place, keeps ownership, balance, XP and equipment, and creates a last-good mirror. It does not clear localStorage, send a Clear-Site-Data header, or register a service worker.

Use the same **protocol + hostname + port** players previously used. A custom domain, the `netlify.app` address, and a deploy-preview address have separate browser storage. A preview can therefore appear empty even when the production save still exists. This release does not rename your site or change its URL.

After publishing, check the same normal browser profile on the original address: coins, Ninja ownership, equipped class/cosmetics, shop price, graphics settings, `/shop`, `/showcase`, `/multiplayer`, and a boss fight. Refresh once, then close/reopen the tab and check again. A local development-to-production build swap was tested; an actual upload to your Netlify account has not been performed here.

Keep the previous release and an exported backup. Prefer rolling forward if a problem is found: an old game bundle cannot understand all new purchase metadata. Legacy-tab compatibility protects the core unlocks/balance, but full metadata is best maintained by this release or newer.

Static Netlify hosting provides the application files. It does not supply authenticated, cross-device player saves. See `FUTURE-CLOUD-SAVES.md` for the proposed backend work.
