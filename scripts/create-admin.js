// Crée (ou promeut) un compte modérateur : npm run create-admin -- email@exemple.fr "Prénom" "Nom"
const readline = require('node:readline/promises');
const { openDatabase } = require('../src/db');
const config = require('../src/config');
const { createModels } = require('../src/models');

(async () => {
  const [email, firstName = 'Admin', lastName = 'Plateforme'] = process.argv.slice(2);
  if (!email) {
    console.error('Usage : npm run create-admin -- email@exemple.fr "Prénom" "Nom"');
    process.exit(1);
  }
  const db = openDatabase();
  const m = createModels(db, config);
  const existing = m.users.byEmail(email);
  if (existing) {
    db.prepare('UPDATE users SET is_staff = 1 WHERE id = ?').run(existing.id);
    console.log(`${email} est maintenant modérateur.`);
    return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question('Mot de passe (8 caractères min.) : ');
  rl.close();
  if (password.length < 8) { console.error('Mot de passe trop court.'); process.exit(1); }
  m.users.create({ email, password, firstName, lastName, isStaff: true });
  console.log(`Compte modérateur ${email} créé.`);
})();
