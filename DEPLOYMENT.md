# LetsTrack / LiveChat Deployment Guide

This document contains standard instructions to deploy changes to the live VPS.

## VPS Environment Details
- **App Directory**: `/var/www/letstrack.manacity.in`
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
cd /var/www/letstrack.manacity.in

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

---

## 🚧 VPS Maintenance & Emergency "Under Development" Mode

Use these procedures when a client site needs to be placed on hold, under maintenance, or under development (e.g. pending payments, license checks, or redesigns).

### Method 1: Nginx Maintenance Switch (Recommended - Leaves App Files 100% Untouched)

#### 1. Enable Maintenance Mode:
```bash
# A. Create the reusable maintenance page
mkdir -p /var/www/maintenance
cat << 'EOF' > /var/www/maintenance/index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Under Development - Technical Administration</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0B0E14;
      color: #F3F4F6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #151A23;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 48px 32px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .icon { font-size: 54px; margin-bottom: 20px; display: inline-block; }
    h1 { font-size: 24px; font-weight: 700; color: #FFFFFF; margin-bottom: 12px; }
    .badge {
      display: inline-block;
      background: rgba(234, 179, 8, 0.15);
      color: #FACC15;
      border: 1px solid rgba(234, 179, 8, 0.3);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    p { color: #9CA3AF; font-size: 14.5px; line-height: 1.6; margin-bottom: 24px; }
    .divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 24px 0; }
    .footer-note { font-size: 12px; color: #6B7280; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚧</div>
    <span class="badge">Development in Progress</span>
    <h1>Website Under Development</h1>
    <p>This portal is temporarily offline for scheduled system updates, license verification, and technical maintenance.</p>
    <div class="divider"></div>
    <div class="footer-note">Technical Administration &bull; System Notice</div>
  </div>
</body>
</html>
EOF

# B. Switch Nginx root (Example for lakshitatradingacademy.com)
sed -i.bak 's|root /var/www/lakshitatradingacademy/dist;|root /var/www/maintenance;|g' /etc/nginx/sites-enabled/*lakshita*
nginx -t && systemctl reload nginx

# C. Pause PM2 Backend
pm2 stop lakshita-api
pm2 save
```

#### 2. Restore Site Back Online:
```bash
# A. Restore original root in Nginx
sed -i 's|root /var/www/maintenance;|root /var/www/lakshitatradingacademy/dist;|g' /etc/nginx/sites-enabled/*lakshita*
nginx -t && systemctl reload nginx

# B. Restart PM2 backend
pm2 start lakshita-api
pm2 save
```

---

### Method 2: Fast index.html Swap

```bash
# 1. Put on Hold
cp /var/www/lakshitatradingacademy/dist/index.html /var/www/lakshitatradingacademy/dist/index.html.backup
cp /var/www/maintenance/index.html /var/www/lakshitatradingacademy/dist/index.html
pm2 stop lakshita-api && pm2 save

# 2. Bring Back Online
cp /var/www/lakshitatradingacademy/dist/index.html.backup /var/www/lakshitatradingacademy/dist/index.html
pm2 start lakshita-api && pm2 save
```
