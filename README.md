# Daybook

David's calendar and floating task lists. One app, synced between the Fold and the Mac through a private Supabase database.

- `index.html`, `src/` – the app (plain JavaScript, built with Vite)
- `supabase/schema.sql` – the database: one table, private to each signed-in user, with live updates
- `android/` – the Android app (Capacitor)
- `.github/workflows/android.yml` – builds `Daybook.apk` on every push and attaches it to the **Daybook for Android** release

## One-time setup

### 1. Supabase (the server)
1. Create a free project at [supabase.com](https://supabase.com). Pick the region closest to Morocco (for example Frankfurt or Paris).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and press **Run**.
3. **Authentication → Users → Add user → Create new user**: your email and a strong password, with **Auto Confirm User** ticked.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up", so nobody else can create an account on your server.
5. **Project Settings → API Keys** (or **Data API**): copy the **Project URL** and the **publishable / anon** key. Never use the `service_role` or secret key in the app.

### 2. GitHub
**Settings → Secrets and variables → Actions → Variables tab → New repository variable**, add:
- `SUPABASE_URL` = your Project URL
- `SUPABASE_ANON_KEY` = your publishable / anon key

Then **Actions → Build Android app → Run workflow** (or push any change).

### 3. Install on the Fold
Open **Releases → Daybook for Android** on the Fold, tap `Daybook.apk`, and allow installs from your browser when Android asks. Later builds install over the top as updates.

## Working on it
```bash
npm install
npm run dev            # open in a browser
npm run android        # build and copy into the Android project
```
