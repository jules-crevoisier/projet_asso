const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const defaultConfig = require('./config');
const { openDatabase } = require('./db');
const { createModels } = require('./models');
const { createPermissions } = require('./lib/permissions');
const { createMailer } = require('./lib/mailer');
const SqliteStore = require('./lib/session-store');
const { csrf } = require('./lib/security');
const helpers = require('./lib/view-helpers');

const ROOT = path.join(__dirname, '..');

function createApp({ db = openDatabase(), config = defaultConfig, mailer } = {}) {
  const app = express();
  const models = createModels(db, config);
  const perms = createPermissions(models);
  const mail = mailer || createMailer(config);
  const ctx = { models, perms, config, mailer: mail };
  app.locals.ctx = ctx;

  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        // FullCalendar injecte ses styles à l'exécution
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
  }));

  const staticOpts = { maxAge: config.isProd ? '7d' : 0 };
  app.use('/static', express.static(path.join(ROOT, 'public'), staticOpts));
  app.use('/vendor/fullcalendar', express.static(path.join(ROOT, 'node_modules/fullcalendar'), staticOpts));
  app.use('/vendor/fullcalendar-locales', express.static(path.join(ROOT, 'node_modules/@fullcalendar/core/locales'), staticOpts));
  app.use('/vendor/inter', express.static(path.join(ROOT, 'node_modules/@fontsource-variable/inter'), staticOpts));

  app.use(express.urlencoded({ extended: false, limit: '200kb' }));
  app.use(express.json({ limit: '50kb' }));

  app.use(session({
    name: 'assos.sid',
    store: new SqliteStore(db),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 1000 * 60 * 60 * 24 * 30 },
  }));
  // Utilisateur courant, messages flash et variables communes aux vues
  app.use((req, res, next) => {
    const user = req.session.userId ? models.users.byId(req.session.userId) : null;
    if (req.session.userId && !user) delete req.session.userId;
    req.user = user || null;

    req.flash = (type, message) => {
      req.session.flash = [...(req.session.flash || []), { type, message }];
    };
    const flash = req.session.flash || [];
    delete req.session.flash;

    Object.assign(res.locals, helpers, {
      user: req.user,
      flash,
      path: req.path,
      platformName: config.platformName,
      city: config.city,
      requireValidation: config.requireValidation,
      pendingRequests: req.user ? models.memberships.pendingForAdmin(req.user.id).length : 0,
      pendingValidation: req.user && req.user.is_staff ? models.associations.countPending() : 0,
    });

    /** Rend une page dans la mise en page commune. */
    res.page = (view, locals = {}) => {
      res.render(`pages/${view}`, locals, (err, body) => {
        if (err) return next(err);
        return res.render('layout', { ...locals, body });
      });
    };
    next();
  });
  app.use(csrf);

  app.use(require('./routes/home')(ctx));
  app.use(require('./routes/auth')(ctx));
  app.use('/associations', require('./routes/associations')(ctx));
  app.use('/evenements', require('./routes/events')(ctx));
  app.use('/annonces', require('./routes/board')(ctx));
  app.use('/api', require('./routes/api')(ctx));

  app.use((req, res) => {
    res.status(404).page('error', { title: 'Page introuvable', status: 404, message: "Cette page n'existe pas ou a été déplacée." });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    const message = status >= 500 ? 'Une erreur inattendue est survenue.' : err.message;
    if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
    if (typeof res.page !== 'function') return res.status(status).send(message);
    return res.status(status).page('error', { title: status === 403 ? 'Accès refusé' : 'Erreur', status, message });
  });

  return app;
}

module.exports = { createApp };
