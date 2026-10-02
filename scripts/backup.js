// Sauvegarde à chaud de la base SQLite (sans arrêter le site).
//   node scripts/backup.js [dossier]   → <dossier>/assos-AAAA-MM-JJ-HHMM.db
// Dans le conteneur : docker exec <conteneur> node scripts/backup.js  (dossier par défaut : /data/backups)
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const source = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'assos.db');
const dir = process.argv[2] || path.join(path.dirname(source), 'backups');
const keep = Number(process.env.BACKUP_KEEP || 14);

fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const target = path.join(dir, `assos-${stamp}.db`);

const db = new Database(source, { readonly: true });
db.backup(target)
  .then(() => {
    db.close();
    console.log(`Sauvegarde écrite : ${target}`);
    // On ne garde que les N dernières sauvegardes
    const files = fs.readdirSync(dir).filter((f) => /^assos-.*\.db$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - keep))) fs.unlinkSync(path.join(dir, f));
  })
  .catch((err) => {
    console.error('Échec de la sauvegarde :', err.message);
    process.exit(1);
  });
