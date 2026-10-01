process.env.NODE_ENV = 'test';
const request = require('supertest');
const { createApp } = require('../src/app');
const { openDatabase } = require('../src/db');
const { createMailer } = require('../src/lib/mailer');
const baseConfig = require('../src/config');
const { parseParisInput, parisDateKey } = require('../src/lib/time');

function setup(overrides = {}) {
  const config = { ...baseConfig, requireValidation: true, ...overrides };
  const db = openDatabase(':memory:');
  const mailer = createMailer({ ...config, mail: { ...config.mail, host: '' } });
  const app = createApp({ db, config, mailer });
  const { models } = app.locals.ctx;
  return { app, db, models, mailer, config };
}

/** Client HTTP avec cookies et jeton CSRF automatique. */
async function client(app) {
  const agent = request.agent(app);
  let token = '';
  const refresh = async () => {
    const res = await agent.get('/associations');
    token = /name="csrf-token" content="([^"]+)"/.exec(res.text)[1];
  };
  await refresh();
  return {
    agent,
    get: (url) => agent.get(url),
    post: (url, data = {}) => agent.post(url).type('form').send({ _csrf: token, ...data }),
    async login(email, password = 'motdepasse123') {
      const res = await agent.post('/connexion').type('form').send({ _csrf: token, email, password });
      await refresh();
      return res;
    },
  };
}

function makeUser(models, key, extra = {}) {
  return models.users.create({ email: `${key}@exemple.fr`, password: 'motdepasse123', firstName: key, lastName: 'Test', ...extra });
}

function makeAsso(models, owner, name, validated = true) {
  return models.associations.create({
    name, category: 'sport', short_description: 'Test', description: '', email: '', phone: '', website: '', address: '', color: '',
  }, owner.id, validated);
}

/** Date relative (jours depuis aujourd'hui) à l'heure de Paris : { input, iso }. */
function slot(days, time) {
  const d = new Date(`${parisDateKey()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const input = `${d.toISOString().slice(0, 10)}T${time}`;
  return { input, iso: parseParisInput(input).toISOString() };
}

function makeEvent(models, asso, user, days, from, to, extra = {}) {
  return models.events.create({
    association_id: asso.id, title: 'Événement', description: 'Desc', category: 'sport', location: 'Troyes',
    visibility: 'public', volunteers_needed: 0, material_needs: '',
    start_at: slot(days, from).iso, end_at: slot(days, to).iso, ...extra,
  }, user.id);
}

module.exports = { setup, client, makeUser, makeAsso, makeEvent, slot };
