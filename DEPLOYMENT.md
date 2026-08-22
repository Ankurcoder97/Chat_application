# 🚀 Nexus Chat Production Deployment Guide (Render + Vercel)

Follow these step-by-step instructions to deploy Nexus Chat to **Render** (Backend) and **Vercel** (Frontend).

---

## 📋 Prerequisites Checklist
1. **GitHub Repository**: Push your project code to GitHub (`git init`, `git add .`, `git commit -m "Initial commit"`, `git push`).
2. **MongoDB Atlas URI**: (Already configured in `.env`).
3. **Redis Cloud URI**: (Already configured in `.env`).

---

## Step 1: Deploy Backend to Render (Node.js Web Service)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository.
4. Fill in the settings:
   - **Name:** `nexus-backend` (or your choice)
   - **Region:** Any (e.g. `Oregon (US West)` or `Frankfurt (EU)`)
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Instance Type:** `Free` (or `Starter`)

5. Under **Environment Variables**, add the following:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | `mongodb+srv://coderArmy9:%40Aa12345678@codingadda.xzj1rfm.mongodb.net/nexus_chat` |
   | `REDIS_URL` | `redis://default:6078vQrZnAyitbWHXqXIH66H7v2UM2Ut@redis-19476.c11.us-east-1-2.ec2.cloud.redislabs.com:19476` |
   | `JWT_ACCESS_SECRET` | `fa97898c9c8f09731cbab90c93548443d7f66aa3d57ebc44a01e7919476e68098b33e7e2c83bb4ada2edd7cb7fc23b28` |
   | `JWT_REFRESH_SECRET` | `ac85f988ebfd56d5964144bbbaa9ede5214f67b9614135d9a24ec8bac7f9e8412225cfa88d3e18e679909753408d3365` |
   | `CORS_ORIGIN` | `*` *(or your Vercel URL later, e.g. `https://nexus-chat.vercel.app`)* |

6. Click **Create Web Service**.
7. Once deployed, Render will provide your public URL (e.g., `https://nexus-backend-xyz.onrender.com`).
8. Test health check in your browser: `https://nexus-backend-xyz.onrender.com/health` ➔ should return `{"status":"ok"}`.

---

## Step 2: Deploy Frontend to Vercel

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New…** ➔ **Project**.
3. Import your GitHub repository.
4. Configure the Project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend` (⚠️ **Important**)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. Under **Environment Variables**, add:
   | Key | Value | Note |
   | :--- | :--- | :--- |
   | `VITE_API_URL` | `https://nexus-backend-xyz.onrender.com/api/v1` | *(Replace with your Render URL)* |
   | `VITE_SOCKET_URL` | `https://nexus-backend-xyz.onrender.com` | *(Replace with your Render URL)* |

6. Click **Deploy**.
7. Vercel will build your app and give you a live production URL (e.g. `https://nexus-chat.vercel.app`).

---

## Step 3: Connect Frontend to Backend (CORS)

1. Go back to Render Dashboard ➔ `nexus-backend` ➔ **Environment**.
2. Update `CORS_ORIGIN`:
   ```env
   CORS_ORIGIN=https://your-app-name.vercel.app,http://localhost:5173
   ```
3. Render will automatically redeploy with the updated CORS rule.

---

## 🎉 Done!
Your real-time chat, WebRTC voice/video calls, and phone messaging platform are now running live on production!
