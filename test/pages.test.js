const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, client } = require('./helpers');
const { seed } = require('../scripts/seed');

test('toutes les pages s’affichent avec les données de démo', async () => {
  const { app, db } = setup();
  const log = console.log;
  console.log = () => {};
  seed(db);
  console.log = log;
  const anon = await client(app);
  for (const url of ['/', '/evenements', '/evenements/liste', '/associations', '/associations/troyes-a-velo', '/evenements/1', '/connexion', '/inscription']) {
    assert.equal((await anon.get(url)).status, 200, url);
  }
  const camille = await client(app);
  await camille.login('camille@exemple.fr', 'demo-troyes-2026');
  for (const url of ['/tableau-de-bord', '/profil', '/annonces', '/annonces/1', '/annonces/nouvelle', '/evenements/nouveau',
    '/evenements/1/modifier', '/associations/nouvelle', '/associations/troyes-a-velo/membres', '/associations/troyes-a-velo/modifier']) {
    assert.equal((await camille.get(url)).status, 200, url);
  }
  const admin = await client(app);
  await admin.login('admin@exemple.fr', 'demo-troyes-2026');
  for (const url of ['/associations/moderation', '/annonces/1/modifier', '/tableau-de-bord']) {
    assert.equal((await admin.get(url)).status, 200, url);
  }
  assert.equal((await anon.get('/page-inexistante')).status, 404);
});

test('sonde de santé', async () => {
  const { app } = setup();
  const res = await (await client(app)).get('/healthz');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});
