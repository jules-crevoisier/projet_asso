const config = require('./src/config');
const { createApp } = require('./src/app');

const app = createApp();
const { models } = app.locals.ctx;

// Compte modérateur créé au premier démarrage (pratique sur Dokploy, sans accès au terminal)
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (ADMIN_EMAIL && ADMIN_PASSWORD && !models.users.byEmail(ADMIN_EMAIL)) {
  if (ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD doit faire au moins 8 caractères : compte modérateur non créé.');
  } else {
    models.users.create({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, firstName: 'Admin', lastName: 'Plateforme', isStaff: true });
    console.log(`Compte modérateur ${ADMIN_EMAIL} créé.`);
  }
}

const server = app.listen(config.port, () => {
  console.log(`${config.platformName} est lancé sur le port ${config.port}`);
});

// Arrêt propre (redéploiement, docker stop) : on termine les requêtes puis on ferme la base
function shutdown(signal) {
  console.log(`${signal} reçu, arrêt en cours…`);
  server.close(() => {
    try { models.db.close(); } catch { /* déjà fermée */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
