# HCM Lite Deployment Guide

Your project is already pushed to GitHub at:
`https://github.com/AnasRashid5/Smit_Hackathon`

This application is a **Vite + React SPA** backed by **Supabase**. Since it uses client-side routing (`react-router-dom`), the [`vercel.json`](file:///e:/SMIT%20Assignments/Hackathon(HCM)/vercel.json) rewrite rule is already configured.

---

## 1. Deploy on Vercel (Recommended for Frontend & SPA)

Vercel provides automatic SSL, global CDN, and zero-downtime continuous deployments whenever you push to GitHub.

### Step 1: Open Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account (`AnasRashid5`).

### Step 2: Import the Repository
1. In the Vercel dashboard, click **"Add New..."** -> **"Project"**.
2. Find and select **`Smit_Hackathon`** and click **Import**.

### Step 3: Configure Project & Environment Variables
1. **Framework Preset**: Vite (detected automatically).
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. Expand **Environment Variables** and add the two keys from your `.env`:
   - `VITE_SUPABASE_URL`: *(Your Supabase project URL)*
   - `VITE_SUPABASE_ANON_KEY`: *(Your Supabase anon public key)*

### Step 4: Deploy
- Click **Deploy**. Within ~1 minute, Vercel will give you a public URL (e.g. `https://smit-hackathon.vercel.app`) that works on any computer, phone, or tablet anywhere in the world!

---

## 2. Deploy on Railway

Railway can also host static sites or serve the built production app via a lightweight static server (such as `serve` or Nginx).

### Option A: Direct Web Deployment via Railway Dashboard
1. Go to [railway.com](https://railway.com) and log in with GitHub.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select **`AnasRashid5/Smit_Hackathon`**.
4. Click **Add Variables** and configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. In **Settings** -> **Build & Deploy**:
   - **Build Command**: `npm run build`
   - **Start Command**: `npx serve -s dist -l $PORT`
6. Under **Networking**, click **Generate Domain** to get a public URL (e.g. `*.up.railway.app`).

### Option B: Using Railway CLI
If you prefer running from the terminal:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## Supabase Checklist for Production
To ensure logins and authentication work from your new Vercel/Railway URL:
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication** -> **URL Configuration**.
3. Add your Vercel URL (e.g., `https://your-app.vercel.app`) to **Site URL** and **Redirect URLs**.
