# Future account-based saves — proposal only

The current project has no authentication or backend. This release implements browser-local saves and manual backups. Cross-device sync has **not** been implemented or tested.

Supabase is a reasonable next step: it provides Auth and Postgres, while this game can remain hosted on the existing Netlify site. Email sign-in or a supported OAuth provider could identify each player. [Supabase Auth](https://supabase.com/docs/guides/auth)

The following is the proposed design, not delivered functionality:

1. Create an owner-controlled Supabase project. Configure the existing production website address and allowed auth redirect URLs. Keep development redirects separate.
2. Add `profiles`, `wallets`, `class_unlocks`, `cosmetic_inventory`, `equipment`, `boss_stats` and an append-only `transactions` ledger. Tie records to the authenticated user ID, with unique constraints on ownership and transaction idempotency keys.
3. Enable Row Level Security on every player table. Reads must be scoped to the caller's user ID; users must not read or update another account. Supabase documents policies using `auth.uid()` for that identity boundary. [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
4. Put purchasing in a trusted server/database operation. It should derive the price from a protected catalog, lock the wallet row, recheck ownership and funds, debit coins, grant ownership and write one receipt in a single database transaction. Reject direct browser writes to wallet balances and earned unlocks. Repeat requests with the same transaction ID must return the original result.
5. Verify earning as well as spending. A browser assertion that it won a boss fight is not trustworthy. An online economy needs server-validated results, replay verification or an authoritative combat service before those claims can mint coins. Authentication alone does not solve cheating.
6. Keep administrative/service credentials only in protected server environment variables. A browser publishable key is not an administrator credential; RLS and restricted server operations must enforce the security boundary.
7. Define migration and conflict policies before importing local saves. Local balances can be edited, so blindly uploading them into an authoritative wallet is unsafe. Keep a local backup, use a controlled one-time migration policy, and reconcile server transaction IDs rather than selecting whichever balance is larger. Test two-device edits, retries, expired sessions and offline recovery.

Start with the Free plan for a small prototype if its current quotas and service limitations fit. The pricing page listed Free at $0/month and Pro from $25/month when checked October 18, 2026; verify current terms before activation. No plan was activated and no charges were incurred in this task. [Supabase pricing](https://supabase.com/pricing)

Before calling cloud sync complete, test sign-in/out, strict account isolation, concurrent purchases, reward verification, cross-device persistence, migrations, retries and restoration. Update the game's connection policy and Netlify environment only when that real backend is ready.
