# Progression and economy audit

## Existing systems preserved

The game had eight starter classes, six locked classes, eight immediately accessible bosses, coins, XP, cosmetic drops and equipped auras/trails/hit effects/per-class skins. There were no player accounts, backend database, level system, custom keybind editor, achievements, arena gates, cosmetic shop or other currencies. None were invented in this update.

Storm Mage was already a starter even though Arcane Entity can roll a Storm Mage class drop. It remains a starter; the existing duplicate-class reward rule remains useful. Previously completed boss wins were not recorded, so old win counts cannot be reconstructed. Existing earned rewards are preserved; boss-win counts are recorded from this release onward.

## Save format

The original `stickfight-progress-v1` key now stores schema 2 in one JSON record. It includes unlocks, cosmetics, equipment, balance, XP, selected class, arena/alternate-weapon/touch preferences, boss wins, lifetime earned/spent coins, purchase receipts, recent reward-claim IDs, revision and timestamp. The settings key remains `stick-slam-settings-v1`, with audio, effects quality, reduced motion and pixel intensity. The original keyboard mappings remain unchanged.

Mutations save immediately. A single atomic main-record write commits each purchase's debit, unlock and receipt together. A queue serializes same-tab writes; the Web Locks API also serializes writes across supporting tabs. Ownership and balance are checked again inside that transaction. Unsupported Web Locks environments retain single-tab serialization and atomic record writes; an authoritative online economy still needs a backend.

Boss rewards write a small synchronous recovery journal at the winning frame. The locked transaction then records the reward and claim ID. Interrupted journals replay on startup; a repeated claim is ignored. A +50 duplicate class bonus and the original random drop chances remain unchanged. The journal is removed after the main record commits.

Failed purchases do not grant an unlock or debit coins. Failed reward/preference saves remain in memory and are included in an exported backup. Autosave retries pending changes every 30 seconds and when the page becomes hidden. If storage itself is unavailable, no implementation can persist new data there; the UI reports the failure and offers retry/export instead of claiming success.

Successful records are mirrored under `stickfight-progress-v1:backup`. Invalid primaries recover from that mirror and preserve unreadable text under `:recovery` before repair. Unreadable records without a good mirror, and unknown future schemas, are not automatically overwritten. Imports validate data, union ownership and retain spending receipts. Reimporting a pre-purchase backup does not refund those purchases. Old backups without preferences do not reset current preferences.

The state is browser-local. Closing/reopening a normal browser on the same site retains it; clearing site storage, private browsing, browser eviction or moving to a different browser/device/origin can remove or separate it. Local files are editable by their owner; this is not an anti-cheat system. Export/import provides manual transfer, not cloud sync.

## Class prices

Prices derive from the existing reward configuration, not a new boss economy:

`round_to_100(2000 × (0.18 / class_drop_chance)^0.6 × difficulty_weight × (boss_coin_reward / 80)^0.25)`

Medium = 1, Hard = 1.25, Extreme = 1.5. Ninja's Medium boss, 18% drop and 80-coin payout anchor it at exactly 2,000. The sublinear rarity exponent keeps the 5% class within reach. All bosses are accessible already, so no access cost is fabricated. Difficulty and expected wins proxy effort; fight-duration telemetry is not available.

| Class | Source boss | Difficulty | Drop | Coins per win | Price | Source-boss wins at base payout |
|---|---|---|---:|---:|---:|---:|
| Ninja | Shadow Assassin | Medium | 18% | 80 | 2,000 | 25 |
| Sniper | War Machine | Medium | 15% | 70 | 2,200 | 32 |
| Gladiator | Arena Champion | Hard | 20% | 90 | 2,400 | 27 |
| Assassin | Shadow Rogue | Hard | 18% | 85 | 2,500 | 30 |
| Executioner | Titan Guardian | Hard | 12% | 110 | 3,500 | 32 |
| Elementalist | Elemental Titan | Extreme | 5% | 120 | 7,200 | 60 |

These counts use rounded-up base coin payouts and exclude losses, existing savings and duplicate-class bonuses. Coins from any boss can fund any class. Expected drop wins range from 5 for Gladiator to 20 for Elementalist; the shop deliberately asks for more saved effort to guarantee an unlock. The probabilities, payouts and starter roster are unchanged. Longer live economy playtesting can inform future tuning.
