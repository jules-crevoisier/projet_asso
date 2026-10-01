const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup, client, makeUser, makeAsso, makeEvent, slot } = require('./helpers');
const { parseParisInput, toParisInput } = require('../src/lib/time');
const { fold } = require('../src/lib/ical');

function world() {
  const env = setup();
  const { models } = env;
  const alice = makeUser(models, 'alice');
  const bob = makeUser(models, 'bob');
  const velo = makeAsso(models, alice, 'Vélo');
  const theatre = makeAsso(models, bob, 'Théâtre');
  const fete = makeEvent(models, velo, alice, 5, '10:00', '18:00', { title: 'Fête du vélo' });
  return { ...env, alice, bob, velo, theatre, fete };
}

const form = (asso, overrides = {}) => ({
  association_id: asso.id, title: 'Spectacle', category: 'culture', start: slot(5, '15:00').input, end: slot(5, '17:00').input,
  location: 'Théâtre', description: 'Pièce', visibility: 'public', volunteers_needed: '0', material_needs: '', ...overrides,
});

test('heure de Paris : conversion aller-retour, été comme hiver', () => {
  assert.equal(parseParisInput('2026-07-14T10:00').toISOString(), '2026-07-14T08:00:00.000Z');
  assert.equal(parseParisInput('2026-12-25T10:00').toISOString(), '2026-12-25T09:00:00.000Z');
  assert.equal(toParisInput('2026-07-14T08:00:00.000Z'), '2026-07-14T10:00');
  assert.equal(parseParisInput('n’importe quoi'), null);
});

test('conflit de créneau : avertissement puis confirmation', async () => {
  const { app, models, theatre } = world();
  const c = await client(app);
  await c.login('bob@exemple.fr');
  let res = await c.post('/evenements/nouveau', form(theatre));
  assert.equal(res.status, 200);
  assert.match(res.text, /Fête du vélo/);
  assert.match(res.text, /Publier quand même/);
  assert.equal(models.events.list({ user: { id: 1 } }).length, 1);

  res = await c.post('/evenements/nouveau', form(theatre, { confirm: '1' }));
  assert.equal(res.status, 302);
  assert.equal(models.events.list({ user: { id: 1 } }).length, 2);
});

test('pas de conflit : publication directe', async () => {
  const { app, theatre } = world();
  const c = await client(app);
  await c.login('bob@exemple.fr');
  const res = await c.post('/evenements/nouveau', form(theatre, { start: slot(12, '15:00').input, end: slot(12, '17:00').input }));
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /^\/evenements\/\d+$/);
});

test('validation : fin avant début refusée', async () => {
  const { app, theatre } = world();
  const c = await client(app);
  await c.login('bob@exemple.fr');
  const res = await c.post('/evenements/nouveau', form(theatre, { start: slot(5, '17:00').input, end: slot(5, '15:00').input }));
  assert.equal(res.status, 422);
  assert.match(res.text, /après le début/);
});

test('impossible de publier pour une association dont on n’est pas membre', async () => {
  const { app, velo } = world();
  const c = await client(app);
  await c.login('bob@exemple.fr');
  const res = await c.post('/evenements/nouveau', form(velo, { confirm: '1' }));
  assert.equal(res.status, 422);
});

test('une association non validée ne peut pas publier', async () => {
  const { app, models } = world();
  const carol = makeUser(models, 'carol');
  makeAsso(models, carol, 'Pas validée', false);
  const c = await client(app);
  await c.login('carol@exemple.fr');
  assert.equal((await c.get('/evenements/nouveau')).headers.location, '/associations');
});

test('seuls les membres modifient ou suppriment un événement', async () => {
  const { app, models, fete } = world();
  const c = await client(app);
  await c.login('bob@exemple.fr');
  assert.equal((await c.get(`/evenements/${fete}/modifier`)).status, 403);
  assert.equal((await c.post(`/evenements/${fete}/supprimer`)).status, 403);
  const a = await client(app);
  await a.login('alice@exemple.fr');
  assert.equal((await a.get(`/evenements/${fete}/modifier`)).status, 200);
  await a.post(`/evenements/${fete}/supprimer`);
  assert.equal(models.events.byId(fete), undefined);
});

test('participation, bénévolat et commentaire', async () => {
  const { app, models, fete, theatre, velo, bob } = world();
  const c = await client(app);
  await c.login('bob@exemple.fr');
  await c.post(`/evenements/${fete}/participer`, { association_id: theatre.id, kind: 'coorg', message: 'On aide' });
  assert.equal(models.events.participations(fete).length, 1);
  // Pas au nom d'une association dont on n'est pas membre
  await c.post(`/evenements/${fete}/participer`, { association_id: velo.id, kind: 'coorg' });
  assert.equal(models.events.participations(fete).length, 1);

  await c.post(`/evenements/${fete}/benevole`);
  assert.equal(models.events.isVolunteer(fete, bob.id), true);
  await c.post(`/evenements/${fete}/benevole`);
  assert.equal(models.events.isVolunteer(fete, bob.id), false);

  await c.post(`/evenements/${fete}/commentaires`, { body: 'Bonne idée !' });
  assert.equal(models.events.comments(fete).length, 1);
});

test('événements réservés au réseau invisibles pour les visiteurs', async () => {
  const { app, models, velo, alice } = world();
  const secret = makeEvent(models, velo, alice, 6, '18:00', '20:00', { title: 'Réunion interne', visibility: 'network' });
  const anon = await client(app);
  assert.doesNotMatch((await anon.get('/evenements/liste')).text, /Réunion interne/);
  assert.equal((await anon.get(`/evenements/${secret}`)).status, 302);
  const c = await client(app);
  await c.login('bob@exemple.fr');
  assert.match((await c.get('/evenements/liste')).text, /Réunion interne/);
});

test('API du calendrier : filtres et visibilité', async () => {
  const { app, models, theatre, bob } = world();
  makeEvent(models, theatre, bob, 7, '20:00', '22:00', { title: 'Pièce de Bob', visibility: 'network' });
  const range = `start=${encodeURIComponent(slot(-1, '00:00').iso)}&end=${encodeURIComponent(slot(40, '00:00').iso)}`;
  const anon = await client(app);
  let events = (await anon.get(`/api/evenements?${range}`)).body;
  assert.deepEqual(events.map((e) => e.title), ['Fête du vélo']);

  const c = await client(app);
  await c.login('alice@exemple.fr');
  events = (await c.get(`/api/evenements?${range}`)).body;
  assert.equal(events.length, 2);
  events = (await c.get(`/api/evenements?${range}&mes=1`)).body;
  assert.deepEqual(events.map((e) => e.title), ['Fête du vélo']);
  assert.equal(events[0].borderColor, models.associations.bySlug('velo').color);
  assert.equal((await c.get('/api/evenements')).status, 400);
});

test('API des conflits (vérification en direct)', async () => {
  const { app } = world();
  const c = await client(app);
  await c.login('bob@exemple.fr');
  const res = await c.get(`/api/conflits?start=${slot(5, '12:00').input}&end=${slot(5, '13:00').input}`);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, 'Fête du vélo');
  const none = await c.get(`/api/conflits?start=${slot(6, '12:00').input}&end=${slot(6, '13:00').input}`);
  assert.equal(none.body.length, 0);
});

test('flux iCal public et personnel', async () => {
  const { app, models, velo, alice } = world();
  makeEvent(models, velo, alice, 6, '18:00', '20:00', { title: 'Réunion réseau', visibility: 'network' });
  const anon = await client(app);
  const pub = await anon.get('/evenements/ical/public.ics');
  assert.match(pub.headers['content-type'], /text\/calendar/);
  assert.match(pub.text, /SUMMARY:Fête du vélo/);
  assert.doesNotMatch(pub.text, /Réunion réseau/);
  const priv = await anon.get(`/evenements/ical/${alice.calendar_token}.ics`);
  assert.match(priv.text, /SUMMARY:Réunion réseau/);
  assert.equal((await anon.get('/evenements/ical/inconnu.ics')).status, 404);
});

test('iCal : lignes repliées à 75 octets', () => {
  for (const part of fold(`DESCRIPTION:${'é'.repeat(100)}`).split('\r\n')) {
    assert.ok(Buffer.byteLength(part) <= 75);
  }
});

test('pages du calendrier', async () => {
  const { app } = world();
  const c = await client(app);
  assert.equal((await c.get('/evenements')).status, 200);
  assert.equal((await c.get('/evenements/liste?passes=1')).status, 200);
  assert.equal((await c.get('/evenements/9999')).status, 404);
});
