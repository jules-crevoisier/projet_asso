const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, client, makeUser, makeAsso } = require('./helpers');

test('annonce : publication, réponse, clôture par un membre seulement', async () => {
  const { app, models } = setup();
  const alice = makeUser(models, 'alice');
  makeUser(models, 'bob');
  const asso = makeAsso(models, alice, 'Asso');
  const a = await client(app);
  await a.login('alice@exemple.fr');
  const res = await a.post('/annonces/nouvelle', { association_id: asso.id, kind: 'lend', title: 'Prêt de tables', body: '10 tables' });
  const id = Number(res.headers.location.split('/').pop());

  const b = await client(app);
  await b.login('bob@exemple.fr');
  await b.post(`/annonces/${id}/repondre`, { body: 'Intéressé !' });
  assert.equal(models.posts.replies(id).length, 1);
  assert.equal((await b.post(`/annonces/${id}/cloturer`)).status, 403);
  assert.equal((await b.post(`/annonces/${id}/supprimer`)).status, 403);

  await a.post(`/annonces/${id}/cloturer`);
  assert.equal(models.posts.byId(id).is_closed, 1);
});

test('annonces : filtres par type et recherche', async () => {
  const { app, models } = setup();
  const alice = makeUser(models, 'alice');
  const asso = makeAsso(models, alice, 'Asso');
  models.posts.create({ association_id: asso.id, kind: 'lend', title: 'Prêt de barnums', body: 'x' }, alice.id);
  models.posts.create({ association_id: asso.id, kind: 'volunteers', title: 'Cherche bras', body: 'x' }, alice.id);
  const c = await client(app);
  await c.login('alice@exemple.fr');
  const res = await c.get('/annonces?type=lend');
  assert.match(res.text, /Prêt de barnums/);
  assert.doesNotMatch(res.text, /Cherche bras/);
});

test('annonces réservées aux personnes connectées', async () => {
  const { app } = setup();
  assert.equal((await (await client(app)).get('/annonces')).status, 302);
});
