# Meta setup (System User token — do this once)

We use a System User token, not OAuth login, so the integration never
depends on a human re-authenticating (see the brief discussion — an OAuth
user token expires ~60 days, a System User token doesn't).

1. **Business Settings → Users → System Users** → Add → name it e.g.
   `nail-fest-app`, role **Admin**.
2. **Assign assets**: give that System User access to your Ad Account and
   your Pixel (Business Settings → Ad Accounts / Data Sources → Pixels →
   Assign Partners → the System User).
3. On the System User's page, **Generate New Token** → select the app you
   want to use (create one under Business Settings → Accounts → Apps if you
   don't have one yet) → permissions: `ads_management`, `business_management`.
   Copy the token — Meta only shows it once.
4. Find your **Pixel ID** (Events Manager → Data Sources) and **Ad Account
   ID** (Business Settings → Ad Accounts, looks like `act_1234567890`).
5. Store everything:
   ```
   META_SYSTEM_USER_TOKEN=<the token from step 3>
   META_AD_ACCOUNT_ID=act_1234567890
   META_PIXEL_ID=<pixel id>
   APP_SECRET_KEY=<openssl rand -hex 32>
   npm run meta:setup
   ```
   This encrypts the token and stores it as a `MetaConnection` row — the
   token never sits in plaintext in the database.
6. **Testing before trusting real sends**: Events Manager → your Pixel →
   Test Events → copy the Test Event Code into `META_TEST_EVENT_CODE` in
   your `.env`. Every event sent while that's set shows up live in the Test
   Events tab instead of counting as production data. Remove it once you're
   confident and ready for real traffic.
7. **Seed audiences** (run once, or whenever you want to confirm they still
   exist): call `ensureSeedAudiences()` from `src/lib/meta/audiences.ts` —
   there's no CLI wrapper for this yet, add one if you want it outside a
   REPL/route.

No App Review needed: this only ever acts on your own Business Manager's
assets, which is exactly the case Meta exempts from that process.
