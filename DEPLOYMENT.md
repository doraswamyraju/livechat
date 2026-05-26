root@srv875579:/var/www/livechat.vrhere.in/backend# # 1. Go to the livechat folder
cd /var/www/livechat.vrhere.in

# 2. Pull the update
git pull origin main

# 3. Restart the backend process to apply the fix
cd backend
pm2 restart livechat-backend --update-env
remote: Enumerating objects: 7, done.
remote: Counting objects: 100% (7/7), done.
remote: Compressing objects: 100% (1/1), done.
remote: Total 4 (delta 3), reused 4 (delta 3), pack-reused 0 (from 0)
Unpacking objects: 100% (4/4), 491 bytes | 245.00 KiB/s, done.
From https://github.com/doraswamyraju/livechat
 * branch            main       -> FETCH_HEAD
   23e670a..1e3d885  main       -> origin/main
Updating 23e670a..1e3d885
Fast-forward
 backend/server.js | 13 ++++++++++---
 1 file changed, 10 insertions(+), 3 deletions(-)
[PM2] Spawning PM2 daemon with pm2_home=/root/.pm2
[PM2] PM2 Successfully daemonized
[PM2][ERROR] Process or Namespace livechat-backend not found
root@srv875579:/var/www/livechat.vrhere.in/backend## LetsTrack / LiveChat Deployment Guide

This document contains standard instructions to deploy changes to the live VPS.

## VPS Environment Details
- **App Directory**: `/var/www/livechat.vrhere.in`
- **PM2 Process Name**: `livechat-backend`
- **Server Ports**:
  - Backend API: `5004` (mapped to SSL reverse proxy subdomain: `livechat.vrhere.in`)
  - WebSockets Endpoint: `ws://localhost:5004` / `wss://livechat.vrhere.in`

---

## Deployment Steps

Run these commands in order on the live VPS:

```bash
# 1. Navigate to the project root directory
# (Run `pm2 show livechat-backend` to check the directory if the path is different)
cd /var/www/livechat.vrhere.in

# 2. Pull the latest commits from GitHub
git pull origin main

# 3. Build the Dashboard frontend
cd dashboard
npm install
npm run build

# 4. Update dependencies in backend and restart
cd ../backend
npm install
pm2 restart livechat-backend --update-env

# 5. Save the PM2 process list to persist across server reboots
pm2 save
```

---

## Troubleshooting & Diagnostics

### View Real-time App Logs
```bash
pm2 logs livechat-backend
```

### Check Process Status
```bash
pm2 status
```
or 
```bash
pm2 list
```
