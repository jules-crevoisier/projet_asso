const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, client, makeUser } = require('./helpers');

test('inscription puis connexion automatique', async () => {
  const { app, models } = setup();
  const c = await client(app);
  const res = await c.post('/inscription', { firstName: 'Alice', lastName: 'Dupont', email: 'Alice@Exemple.fr', password: 'un-mot-de-passe' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/associations');
  assert.ok(models.users.byEmail('alice@exemple.fr'));
  const dash = await c.get('/tableau-de-bord');
  assert.equal(dash.status, 200);
  assert.match(dash.text, /Alice/);
});

test('inscription refusée : e-mail déjà pris ou mot de passe court', async () => {
  const { app, models } = setup();
  makeUser(models, 'alice');
  const c = await client(app);
  let res = await c.post('/inscription', { firstName: 'A', lastName: 'B', email: 'ALICE@exemple.fr', password: 'un-mot-de-passe' });
  assert.equal(res.status, 422);
  assert.match(res.text, /existe déjà/);
  res = await c.post('/inscription', { firstName: 'A', lastName: 'B', email: 'bob@exemple.fr', password: 'court' });
  assert.equal(res.status, 422);
});

test('connexion : bon et mauvais mot de passe', async () => {
  const { app, models } = setup();
  makeUser(models, 'bob');
  const c = await client(app);
  assert.equal((await c.login('bob@exemple.fr', 'faux-mot-de-passe')).status, 401);
  const ok = await c.login('BOB@exemple.fr');
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.location, '/tableau-de-bord');
});

test('les pages protégées redirigent vers la connexion puis reviennent', async () => {
  const { app, models } = setup();
  makeUser(models, 'bob');
  const c = await client(app);
  const res = await c.get('/annonces');
  assert.equal(res.headers.location, '/connexion');
  const login = await c.login('bob@exemple.fr');
  assert.equal(login.headers.location, '/annonces');
});

test('requête POST sans jeton CSRF rejetée', async () => {
  const { app } = setup();
  const c = await client(app);
  const res = await c.agent.post('/inscription').type('form').send({ firstName: 'A', lastName: 'B', email: 'x@y.fr', password: 'un-mot-de-passe' });
  assert.equal(res.status, 403);
});

test('mot de passe oublié : lien envoyé puis réinitialisation', async () => {
  const { app, models, mailer } = setup();
  makeUser(models, 'carol');
  const c = await client(app);
  await c.post('/mot-de-passe-oublie', { email: 'carol@exemple.fr' });
  assert.equal(mailer.sent.length, 1);
  const link = /\/reinitialiser\/[a-f0-9]+/.exec(mailer.sent[0].text)[0];
  assert.equal((await c.post(link, { password: 'nouveau-mdp-123' })).status, 302);
  assert.equal((await c.login('carol@exemple.fr', 'nouveau-mdp-123')).status, 302);
  // Le lien ne sert qu'une fois
  const again = await c.get(link);
  assert.match(again.text, /expiré/);
});

test('mot de passe oublié : pas d’e-mail pour une adresse inconnue', async () => {
  const { app, mailer } = setup();
  const c = await client(app);
  const res = await c.post('/mot-de-passe-oublie', { email: 'inconnu@exemple.fr' });
  assert.equal(res.status, 200);
  assert.equal(mailer.sent.length, 0);
});

test('profil : mise à jour et régénération du lien d’agenda', async () => {
  const { app, models } = setup();
  const u = makeUser(models, 'dan');
  const c = await client(app);
  await c.login('dan@exemple.fr');
  await c.post('/profil', { firstName: 'Daniel', lastName: 'Test', phone: '0600000000', bio: '' });
  assert.equal(models.users.byId(u.id).first_name, 'Daniel');
  await c.post('/profil/agenda/regenerer');
  assert.notEqual(models.users.byId(u.id).calendar_token, u.calendar_token);
});
