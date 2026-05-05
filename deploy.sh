#!/bin/bash
set -e

SERVER="root@178.104.129.87"
APP_PATH="/var/www/ptag-props"

echo "Deploying to thepeoplesprops.uk..."

ssh "$SERVER" "
  cd $APP_PATH &&
  git pull origin main &&
  npm install --omit=dev &&
  pm2 restart ptag-props
"

echo "Done. Live at https://thepeoplesprops.uk"
