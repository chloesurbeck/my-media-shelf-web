# Media Shelf Web App

A modern, responsive web application for your personal media collection (Movies, Television, Video Games, Books, Comics, and Music), powered by Supabase.

---

## 1. Setup Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account and project.
2. In your Supabase Dashboard, click on **SQL Editor** $\rightarrow$ **New Query**.
3. Copy the entire contents of `supabase_schema.sql` and click **Run**.
4. Go to **Project Settings** $\rightarrow$ **API** and copy:
   - **Project URL** (e.g. `https://xyzabcdefg.supabase.co`)
   - **anon public key** (used in the website)
   - **service_role secret key** (used only for importing your data)

---

## 2. Import Your 4,600+ Cleaned Items

Run the following command in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File "import_to_supabase.ps1" -SupabaseUrl "https://YOUR_PROJECT.supabase.co" -ServiceRoleKey "YOUR_SERVICE_ROLE_KEY"
```

This will upload all items across all 6 categories with covers, release years, genres, and statuses in under 30 seconds.

---

## 3. Connect the Web App

Open `config.js` and paste your Supabase URL and public anon key:

```javascript
const SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_PUBLIC_ANON_KEY",
  adminPasscode: "1234" // Choose any passcode for phone editing mode
};
```

You can test it right now by double-clicking `index.html` in your browser!

---

## 4. Deploy Live to the Web (100% Free)

### Option A: Vercel (Recommended - 1 Click)
1. Install Vercel CLI (`npm i -g vercel`) OR drag and drop the `web` folder to [vercel.com](https://vercel.com).
2. Click **Deploy**.
3. You get an instant live HTTPS address: `https://your-media-shelf.vercel.app`.

### Option B: Netlify
1. Go to [netlify.com/drop](https://app.netlify.com/drop).
2. Drag and drop the `web` folder directly into the browser window.
3. Your site is live immediately!

### Option C: GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to **Repository Settings** $\rightarrow$ **Pages** $\rightarrow$ select `main` branch.
3. Your site is live at `https://yourusername.github.io/media-shelf`.

---

## 5. Editing on Your Phone

1. Open your live website on your mobile phone browser (Safari or Chrome).
2. Tap the **Lock icon** in the top right and enter your passcode (`1234`).
3. You are now in **Editor Mode**:
   - Tap any card to open the detail view and tap **Status** (`Watched`, `Plan to Play`, etc.) or edit fields.
   - Tap the heart or star to toggle Favorites and Recommendations.
   - Tap the floating **`+` button** in the bottom right corner to add a new movie, album, or game on the fly!
   - Save changes instantly syncs directly to your Supabase database.
