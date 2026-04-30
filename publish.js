const { exec } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname);
let timer = null;

function schedulePublish() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(runPublish, 3000);
}

function runPublish() {
  timer = null;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const steps = [
    'git add inventory.json uploads/',
    `git diff --cached --quiet || git commit -m "Inventory update ${timestamp}"`,
    'git push origin main',
  ].join(' && ');

  exec(steps, { cwd: ROOT }, (err, stdout, stderr) => {
    if (err) {
      // Push can fail if nothing changed — only log genuine errors
      if (!stderr.includes('nothing to commit') && !stderr.includes('Everything up-to-date')) {
        console.error('[publish] Error:', stderr || err.message);
      }
      return;
    }
    console.log('[publish] Pushed to GitHub Pages');
  });
}

module.exports = { schedulePublish };
