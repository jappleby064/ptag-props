# PTAG Props — Deployment Guide

## Infrastructure

| | Detail |
|---|---|
| **Live URL** | https://thepeoplesprops.uk |
| **VPS provider** | Hetzner Cloud |
| **Server IP** | 178.104.129.87 |
| **Server spec** | CX23 — 2 vCPU, 4 GB RAM, 40 GB SSD |
| **OS** | Ubuntu 24.04 |
| **App path** | `/var/www/ptag-props` |
| **Process manager** | PM2 (auto-starts on reboot) |
| **Reverse proxy** | Nginx |
| **SSL** | Let's Encrypt via Certbot (auto-renews) |
| **Domain registrar** | Cloudflare |

## How the stack fits together

```
User browser / mobile app
        │
        ▼ HTTPS (port 443)
    Cloudflare DNS
        │
        ▼
    Nginx (reverse proxy)
        │
        ▼ localhost:3000
    Node.js / Express  (managed by PM2)
        │
        ├── inventory.json   (persistent on VPS disk)
        └── uploads/         (persistent on VPS disk)
```

## SSH access

```bash
ssh root@178.104.129.87
```

The root password is stored separately. If you lose it, reset it via the
Hetzner Cloud console (Actions → Reset root password).

## Deploying code changes

After pushing changes to GitHub from your Mac, run the deploy script:

```bash
./deploy.sh
```

This SSHes into the VPS, pulls the latest code, and restarts the app.
It does **not** overwrite `inventory.json` or `uploads/` — those live
only on the VPS and are never touched by a deploy.

## What the deploy script does

1. `git pull origin main` on the VPS
2. `npm install --omit=dev` (in case dependencies changed)
3. `pm2 restart ptag-props`

## Inventory data

- `inventory.json` and `uploads/` live at `/var/www/ptag-props/` on the VPS
- They are **not** in the GitHub repo (`.gitignore`)
- They persist across deploys and reboots
- To back them up manually:

```bash
scp root@178.104.129.87:/var/www/ptag-props/inventory.json ./inventory-backup.json
scp -r root@178.104.129.87:/var/www/ptag-props/uploads/ ./uploads-backup/
```

## PM2 commands (run on VPS via SSH)

```bash
pm2 status               # check app is running
pm2 logs ptag-props      # view live logs
pm2 restart ptag-props   # restart the app
pm2 stop ptag-props      # stop the app
pm2 start ptag-props     # start the app
```

## Nginx commands (run on VPS via SSH)

```bash
nginx -t                        # test config for errors
systemctl restart nginx         # restart nginx
systemctl status nginx          # check nginx is running
cat /etc/nginx/sites-available/ptag-props   # view config
```

## SSL certificate

Certbot auto-renews the Let's Encrypt certificate every 90 days.
To manually renew or check:

```bash
certbot renew --dry-run    # test renewal without applying
certbot renew              # force renewal
```

## Environment variables

Stored at `/var/www/ptag-props/.env` on the VPS:

```
PORT=3000
JWT_SECRET=ptag-theatre-inventory-secret-2026
```

To edit: `nano /var/www/ptag-props/.env` then `pm2 restart ptag-props`.

## If the site goes down — checklist

1. Check PM2: `pm2 status` — if app is `stopped` or `errored`, run `pm2 restart ptag-props`
2. Check Nginx: `systemctl status nginx` — if inactive, run `systemctl restart nginx`
3. Check logs: `pm2 logs ptag-props --lines 50`
4. Check disk space: `df -h` — if full, old logs may need clearing
5. Check the VPS is running in the Hetzner Cloud console

## Updating Node.js or system packages (occasional maintenance)

```bash
apt update && apt upgrade -y
pm2 restart ptag-props
```
