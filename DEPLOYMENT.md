# LetsTrack / LiveChat Deployment Guide

This document contains standard instructions to deploy changes to the live VPS.

## VPS Environment Details
- **App Directory**: `/var/www/letstrack`
- **PM2 Process Name**: `livechat-backend`
- **Server Ports**:
  - Backend API: `5000` (mapped to SSL reverse proxy subdomain: `livechat.vrhere.in`)
  - WebSockets Endpoint: `ws://localhost:5000` / `wss://livechat.vrhere.in`

---

## Deployment Steps

Run these commands in order on the live VPS:

```bash
# 1. Navigate to the project root directory
cd /var/www/letstrack

# 2. Pull the latest commits from GitHub
git pull origin main

# 3. Update dependencies in backend
cd backend
npm install

# 4. Restart the PM2 process to apply backend updates
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
