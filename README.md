# Passport launch kit

A static website. Hosting is free (GitHub Pages) and the database is free (Supabase free tier).

## 1. Put it online (GitHub Pages, ~10 minutes)
1. Create a new public GitHub repo (e.g. `passport`) and upload every file in this folder to the top level, not inside a sub-folder.
2. Go to **Settings → Pages**, set the source to the `main` branch with the `/ (root)` folder, and save.
3. After about a minute it's live at `https://<your-username>.github.io/passport/`.

## 2. Your own domain (do this before sharing widely)
1. Check the name isn't trademarked for games (UK IPO, USPTO, EUIPO), then buy a short domain.
2. In **Settings → Pages → Custom domain**, enter it. At your registrar, add the DNS records GitHub shows, then tick **Enforce HTTPS**.
3. In `index.html`, **find and replace `https://YOUR-DOMAIN`** with your address (4 places). This gives links their preview card (`og.png`) in WhatsApp, iMessage, X and Slack. Check it at opengraph.xyz.

## 3. Connect Supabase: scoreboard, leagues and accounts (~15 minutes)
1. Create a new Supabase project.
2. In **SQL Editor**, paste in all of `passport.sql` and click **Run**. It's safe to run again whenever you update.
3. Open **`your-site/setup.html`**. Paste in your **Project URL** (`https://<project-ref>.supabase.co`, under Project Settings → Data API) and **Publishable key** (`sb_publishable_…`, under Project Settings → API Keys), and pick your **launch date**.
4. Click **Test connection**. It checks every part and tells you exactly what to fix.
5. Copy the `config.js` it generates over the one in your repo (GitHub: open the file → pencil → paste → Commit). That's the only file you ever edit for settings.

### Accounts (players sign in by email to back up their passport)
- **Authentication → URL Configuration:** set **Site URL** to your game's address and add it to Redirect URLs.
- **Authentication → SMTP:** connect your own email sender (e.g. Resend). Supabase's built-in email only reaches your own Supabase team, a couple of times an hour.
- **Optional:** in Authentication → Email Templates → Magic Link, add `{{ .Token }}` so the email also shows a 6-digit code. It helps players who added the game to their home screen.
- **Privacy:** once you collect emails, add a short privacy notice covering what's stored (email, game progress), why, and how to delete it (Settings → Delete account). Not legal advice: check the ICO's guidance for small websites.

## 4. Launch day
- `launchDate` in `config.js` is puzzle No. 1. Set it once and don't change it afterwards, because that renumbers every puzzle.
- If you tested before launch, clear the test scores: SQL Editor → `delete from passport_plays;`
- A new set of five stamps appears at 00:00 UTC (midnight UK time in winter, 1am in summer). You never add puzzles by hand.

## 5. Updating later
- `config.js` changes apply straight away.
- If you upload new `geo.js`, `data.js`, `flags.js`, `common.js` or `common.css`, change `VERSION` in `sw.js` (e.g. `passport-v2`), or installed phones keep the old copy.

## Files
| File | What it is |
|---|---|
| index.html | The game |
| config.js | **Your settings**: Supabase details, launch date, accounts on/off |
| setup.html | Tests your Supabase connection and writes config.js for you |
| passport.sql | Database: scoreboard, leagues, accounts |
| common.js, common.css | Shared game engine and styles |
| geo.js | Map maths (d3-geo, topojson; ISC/MIT licences) |
| data.js | Borders (Natural Earth, public domain) and country facts (world-countries, ODbL: keep the credit) |
| flags.js | Flag images (country-flag-icons, MIT) |
| og.png | 1200×630 link-preview card |
| manifest.webmanifest, icon-*.png, apple-touch-icon.png, favicon.svg | Home-screen app and icons |
| sw.js | Offline support and fast repeat loads |
