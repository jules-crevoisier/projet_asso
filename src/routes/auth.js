const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../lib/http');
const { verifyPassword, randomToken, sha256 } = require('../lib/security');
const { str, isEmail, FormErrors } = require('../lib/forms');

const MIN_PASSWORD = 8;

module.exports = ({ models, config, mailer }) => {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res) => res.status(429).page('error', {
      title: 'Trop de tentatives', status: 429, message: 'Trop de tentatives. Réessayez dans quelques minutes.',
    }),
  });

  function logIn(req, user, cb) {
    const returnTo = req.session.returnTo;
    req.session.regenerate((err) => {
      if (err) return cb(err);
      req.session.userId = user.id;
      return cb(null, returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null);
    });
  }

  // ----- Inscription -----
  router.get('/inscription', (req, res) => {
    if (req.user) return res.redirect('/tableau-de-bord');
    return res.page('auth/signup', { title: 'Créer un compte', values: {}, errors: {} });
  });

  router.post('/inscription', limiter, (req, res, next) => {
    const values = {
      firstName: str(req.body.firstName, 80), lastName: str(req.body.lastName, 80),
      email: str(req.body.email, 200).toLowerCase(),
    };
    const password = String(req.body.password || '');
    const errors = new FormErrors()
      .require('firstName', values.firstName)
      .require('lastName', values.lastName);
    if (!isEmail(values.email)) errors.add('email', 'Adresse e-mail invalide.');
    else if (models.users.byEmail(values.email)) errors.add('email', 'Un compte existe déjà avec cette adresse.');
    if (password.length < MIN_PASSWORD) errors.add('password', `Au moins ${MIN_PASSWORD} caractères.`);
    if (errors.any) return res.status(422).page('auth/signup', { title: 'Créer un compte', values, errors: errors.fields });

    const user = models.users.create({ ...values, password });
    return logIn(req, user, (err) => {
      if (err) return next(err);
      req.flash('success', `Bienvenue ${user.first_name} ! Rejoignez votre association ou créez-la pour commencer.`);
      return res.redirect('/associations');
    });
  });

  // ----- Connexion -----
  router.get('/connexion', (req, res) => {
    if (req.user) return res.redirect('/tableau-de-bord');
    return res.page('auth/login', { title: 'Connexion', email: '', error: null });
  });

  router.post('/connexion', limiter, (req, res, next) => {
    const email = str(req.body.email, 200).toLowerCase();
    const user = models.users.byEmail(email);
    if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) {
      return res.status(401).page('auth/login', { title: 'Connexion', email, error: 'E-mail ou mot de passe incorrect.' });
    }
    return logIn(req, user, (err, returnTo) => {
      if (err) return next(err);
      return res.redirect(returnTo || '/tableau-de-bord');
    });
  });

  router.post('/deconnexion', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('assos.sid');
      return res.redirect('/');
    });
  });

  // ----- Mot de passe oublié -----
  router.get('/mot-de-passe-oublie', (req, res) => res.page('auth/forgot', { title: 'Mot de passe oublié', sent: false }));

  router.post('/mot-de-passe-oublie', limiter, async (req, res) => {
    const user = models.users.byEmail(str(req.body.email, 200));
    if (user) {
      const token = randomToken();
      models.passwordResets.create(sha256(token), user.id, Date.now() + 60 * 60 * 1000);
      const base = config.baseUrl || `${req.protocol}://${req.get('host')}`;
      await mailer.send({
        to: user.email,
        subject: `Réinitialisation de votre mot de passe – ${config.platformName}`,
        text: `Bonjour ${user.first_name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${base}/reinitialiser/${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      });
    }
    res.page('auth/forgot', { title: 'Mot de passe oublié', sent: true });
  });

  router.get('/reinitialiser/:token', (req, res) => {
    const valid = Boolean(models.passwordResets.find(sha256(req.params.token)));
    res.page('auth/reset', { title: 'Nouveau mot de passe', valid, error: null });
  });

  router.post('/reinitialiser/:token', (req, res) => {
    const hash = sha256(req.params.token);
    const reset = models.passwordResets.find(hash);
    if (!reset) return res.page('auth/reset', { title: 'Nouveau mot de passe', valid: false, error: null });
    const password = String(req.body.password || '');
    if (password.length < MIN_PASSWORD) {
      return res.status(422).page('auth/reset', { title: 'Nouveau mot de passe', valid: true, error: `Au moins ${MIN_PASSWORD} caractères.` });
    }
    models.users.setPassword(reset.user_id, password);
    models.passwordResets.consume(hash);
    req.flash('success', 'Mot de passe modifié. Vous pouvez vous connecter.');
    return res.redirect('/connexion');
  });

  // ----- Profil -----
  function renderProfile(req, res, extra = {}) {
    const base = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    res.page('auth/profile', {
      title: 'Mon profil',
      values: { firstName: req.user.first_name, lastName: req.user.last_name, phone: req.user.phone, bio: req.user.bio },
      errors: {},
      passwordError: null,
      memberships: models.memberships.forUser(req.user.id),
      feedUrl: `${base}/evenements/ical/${req.user.calendar_token}.ics`,
      ...extra,
    });
  }

  router.get('/profil', requireAuth, (req, res) => renderProfile(req, res));

  router.post('/profil', requireAuth, (req, res) => {
    const values = {
      firstName: str(req.body.firstName, 80), lastName: str(req.body.lastName, 80),
      phone: str(req.body.phone, 30), bio: str(req.body.bio, 2000),
    };
    const errors = new FormErrors().require('firstName', values.firstName).require('lastName', values.lastName);
    if (errors.any) return renderProfile(req, res, { values, errors: errors.fields });
    models.users.update(req.user.id, values);
    req.flash('success', 'Profil mis à jour.');
    return res.redirect('/profil');
  });

  router.post('/profil/mot-de-passe', requireAuth, (req, res) => {
    const current = String(req.body.currentPassword || '');
    const next = String(req.body.newPassword || '');
    let passwordError = null;
    if (!verifyPassword(current, req.user.password_hash)) passwordError = 'Mot de passe actuel incorrect.';
    else if (next.length < MIN_PASSWORD) passwordError = `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`;
    if (passwordError) return renderProfile(req, res, { passwordError });
    models.users.setPassword(req.user.id, next);
    req.flash('success', 'Mot de passe modifié.');
    return res.redirect('/profil');
  });

  router.post('/profil/agenda/regenerer', requireAuth, (req, res) => {
    models.users.regenerateToken(req.user.id);
    req.flash('success', "Nouveau lien d'abonnement généré. L'ancien ne fonctionne plus.");
    res.redirect('/profil#agenda');
  });

  return router;
};
