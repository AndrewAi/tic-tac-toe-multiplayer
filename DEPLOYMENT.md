# Deployment Guide - Multiplayer Tic Tac Toe

This guide covers deploying your app to **Render.com** (recommended option for small friend groups).

## Prerequisites

1. A GitHub account
2. Push your code to a GitHub repository
3. A Render.com account (free, no credit card required)

---

## Option 1: Render.com (Recommended)

### Step 1: Deploy Backend (Socket.IO Server)

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `tic-tac-toe-backend` (or any name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Click **"Create Web Service"**
6. Wait for deployment to complete (~2-3 minutes)
7. **Copy the service URL** (e.g., `https://tic-tac-toe-backend.onrender.com`)

### Step 2: Deploy Frontend (React App)

1. In Render dashboard, click **"New +"** → **"Static Site"**
2. Connect the same GitHub repository
3. Configure the site:
   - **Name**: `tic-tac-toe-frontend` (or any name)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Add Environment Variable**:
   - Click **"Advanced"** → **"Add Environment Variable"**
   - Key: `VITE_SOCKET_URL`
   - Value: Your backend URL from Step 1 (e.g., `https://tic-tac-toe-backend.onrender.com`)
5. Click **"Create Static Site"**
6. Wait for deployment (~2-3 minutes)
7. **Copy the site URL** (e.g., `https://tic-tac-toe-frontend.onrender.com`)

### Step 3: Share with Friends

Send your friends the frontend URL. They can:
- One person clicks **"Create Room"** and shares the 6-character code
- Others click **"Join a Game"** and enter the code
- Play from anywhere in the world!

---

## Important Notes

### Free Tier Limitations
- Services "spin down" after 15 minutes of inactivity
- First visitor experiences a ~30 second cold start
- Once active, stays up for your entire game session
- Perfect for <10 concurrent users

### Auto-Deployment
Both services automatically redeploy when you push to GitHub:
```bash
git add .
git commit -m "your changes"
git push
```

### Local Development
The app still works locally with:
```bash
npm run dev:all
```

The `.env.local` file keeps your local development pointing to `http://localhost:3001`.

---

## Alternative Options

### Option 2: Vercel (Frontend) + Render (Backend)

**Frontend on Vercel:**
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Add environment variable: `VITE_SOCKET_URL` = your Render backend URL
4. Deploy (auto-detects Vite)

**Pros:** Faster frontend, no cold starts for frontend
**Cons:** Two platforms to manage

### Option 3: Netlify (Frontend) + Railway (Backend)

**Backend on Railway:**
1. Go to [railway.app](https://railway.app) (requires credit card)
2. Deploy from GitHub
3. Set start command: `node server.js`

**Frontend on Netlify:**
1. Go to [netlify.com](https://netlify.com)
2. Import GitHub repo
3. Build: `npm run build`, Publish: `dist`
4. Environment variable: `VITE_SOCKET_URL` = Railway backend URL

**Pros:** Railway has better uptime (500hrs/month)
**Cons:** Requires credit card

---

## Troubleshooting

### "Connection failed" error
- Check that `VITE_SOCKET_URL` environment variable is set correctly in frontend
- Verify backend service is running (visit backend URL in browser)

### Backend keeps sleeping
- Free tier limitation. Consider upgrading to paid tier ($7/month) if you need 24/7 uptime

### CORS errors
- The server.js already has `cors` set to accept all origins
- If you need to restrict, update line 12 in `server.js`

---

## Cost Summary

- **Render Free Tier**: $0/month (both frontend + backend)
- **Render Paid (if needed)**: $7/month per service
- **Vercel Free**: $0/month (frontend only)
- **Railway Free**: $0/month but requires CC, 500 hrs/month

For a casual friend group, the free tier is perfect! 🎮
