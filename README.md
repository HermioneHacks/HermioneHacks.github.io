
# Dishwasher Rotation • By Load (PIN Enabled)

Single-file web app to manage roommate dishwasher rotations. Ready for **Vercel**.
Vercel link (link to site): https://roommate-chores-blue.vercel.app/

## Files
- `index.html` — the entire app (React via CDN, Tailwind via CDN, Babel for JSX)
- `vercel.json` — config to deploy as a static site
- `README.md` — you are here

## Quick Deploy to Vercel (GUI)
1. Go to https://vercel.com and log in.
2. Click **Add New… → Project**.
3. Choose **Import Git Repository** if you have one, *or* click **Continue with Template → Import** to upload a folder.
4. Upload this folder (or push it to a GitHub repo, then import it).
5. Project Settings:
   - **Framework Preset:** Other
   - **Root Directory:** `/` (repo root)
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)
6. Click **Deploy**. You’ll get a live URL like `https://your-project.vercel.app`.

## Quick Deploy to Vercel (CLI)
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. From this project folder, run:
   ```bash
   vercel
   ```
   - When prompted:
     - **Set up and deploy?** `y`
     - **Which scope?** pick your account
     - **Link to existing project?** `n`
     - **Project name:** `dishwasher-rotation` (or anything)
     - **Which directory?** `.`
     - **Framework?** `Other`
     - **Override settings?** `n`
   Vercel will give you a preview URL.
3. Make it production:
   ```bash
   vercel --prod
   ```

## Tip: Custom Domain
- In Vercel → Project → **Settings → Domains**, add `yourcooldomain.com` (or a subdomain).
- Follow the DNS instructions Vercel provides.

## Local Use (no deploy)
- Just open `index.html` by double-clicking it in a browser.
- Data is saved in `localStorage` on that device.

## Notes
- PINs and all state are stored locally per device. To sync across devices, wire up Supabase/Firebase later.
- If you remove Babel for production, you can prebuild with a bundler; this template favors simplicity over bundle size.
