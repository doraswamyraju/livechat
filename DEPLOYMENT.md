# LetsTrack / LiveChat Deployment Guide

This document contains standard instructions to deploy changes to the live VPS.

## VPS Environment Details
- **App Directory**: `/var/www/livechat.vrhere.in`
- **PM2 Process Name**: `livechat-backend` (ID: 7)
- **Domain**: `livechat.vrhere.in`
- **OAuth Client ID**: `931640963201-op9i4jmb31lcm8f4v5ggc0ik1oe1vvjk.apps.googleusercontent.com`
- **Server Ports**:
  - Backend API: `5004` (mapped to SSL reverse proxy: `livechat.vrhere.in`)
  - WebSockets Endpoint: `wss://livechat.vrhere.in`

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
