// Compile le CSS après `npm install`, si Tailwind est installé (dépendance de développement).
// En production (`npm ci --omit=dev`), le CSS est déjà compilé par l'image Docker : on ne fait rien.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const cli = path.join(__dirname, '..', 'node_modules', '@tailwindcss', 'cli');
if (fs.existsSync(cli)) execSync('npm run build:css', { stdio: 'inherit' });
