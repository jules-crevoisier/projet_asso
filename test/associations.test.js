const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, client, makeUser, makeAsso } = require('./helpers');

test('créer une association : créateur responsable, validation requise', async () => {
  const { app, models } = setup();
  const u = makeUser(models, 'owner');
  const c = await client(app);
  await c.login('owner@exemple.fr');
  const res = await c.post('/associations/nouvelle', { name: 'Été Sport', category: 'sport', short_description: 'Une asso' });
  assert.equal(res.headers.location, '/associations/ete-sport');
  const a = models.associations.bySlug('ete-sport');
  assert.equal(a.can_publish, false);
  assert.equal(models.memberships.get(u.id, a.id).role, 'admin');
  // Nom en doublon refusé
  const dup = await c.post('/associations/nouvelle', { name: 'été sport', category: 'sport', short_description: 'x' });
  assert.equal(dup.status, 422);
});

test('sans validation obligatoire, une asso peut publier tout de suite', () => {
  const { models } = setup({ requireValidation: false });
  const a = makeAsso(models, makeUser(models, 'o'), 'Libre', false);
  assert.equal(a.can_publish, true);
});

test('demande d’adhésion puis acceptation par un responsable', async () => {
  const { app, models } = setup();
  const owner = makeUser(models, 'owner');
  const other = makeUser(models, 'other');
  const a = makeAsso(models, owner, 'Club');
  const c = await client(app);
  await c.login('other@exemple.fr');
  await c.post(`/associations/${a.slug}/rejoindre`, { message: 'Bonjour' });
  const m = models.memberships.get(other.id, a.id);
  assert.equal(m.status, 'pending');
  assert.equal((await c.post(`/associations/${a.slug}/membres/${m.id}/accepter`)).status, 403);

  const o = await client(app);
  await o.login('owner@exemple.fr');
  await o.post(`/associations/${a.slug}/membres/${m.id}/accepter`);
  assert.equal(models.memberships.byId(m.id).status, 'active');
});

test('le dernier responsable ne peut pas être rétrogradé', async () => {
  const { app, models } = setup();
  const owner = makeUser(models, 'owner');
  const a = makeAsso(models, owner, 'Club');
  const m = models.memberships.get(owner.id, a.id);
  const c = await client(app);
  await c.login('owner@exemple.fr');
  await c.post(`/associations/${a.slug}/membres/${m.id}/retrograder`);
  assert.equal(models.memberships.byId(m.id).role, 'admin');
});

test('la gestion des membres est réservée aux responsables', async () => {
  const { app, models } = setup();
  const a = makeAsso(models, makeUser(models, 'owner'), 'Club');
  makeUser(models, 'other');
  const c = await client(app);
  await c.login('other@exemple.fr');
  assert.equal((await c.get(`/associations/${a.slug}/membres`)).status, 403);
  assert.equal((await c.get(`/associations/${a.slug}/modifier`)).status, 403);
});

test('modération : seul un modérateur valide', async () => {
  const { app, models } = setup();
  const owner = makeUser(models, 'owner');
  makeUser(models, 'staff', { isStaff: true });
  const a = makeAsso(models, owner, 'À valider', false);
  const c = await client(app);
  await c.login('owner@exemple.fr');
  assert.equal((await c.post(`/associations/${a.slug}/valider`)).status, 403);
  assert.equal((await c.get('/associations/moderation')).status, 403);
  const s = await client(app);
  await s.login('staff@exemple.fr');
  assert.match((await s.get('/associations/moderation')).text, /À valider/);
  await s.post(`/associations/${a.slug}/valider`);
  assert.equal(models.associations.byId(a.id).is_validated, 1);
});

test('annuaire : recherche et filtre', async () => {
  const { app, models } = setup();
  const u = makeUser(models, 'u');
  makeAsso(models, u, 'Club de Volley');
  makeAsso(models, u, 'Chorale');
  const res = await (await client(app)).get('/associations?q=volley');
  assert.match(res.text, /Club de Volley/);
  assert.doesNotMatch(res.text, /Chorale/);
});
