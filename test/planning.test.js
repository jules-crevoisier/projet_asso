const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPlanning } = require('../src/lib/planning');
const { parseParisInput, weekStartKey, isoWeek } = require('../src/lib/time');
const { setup, client, makeUser, makeAsso, makeEvent } = require('./helpers');

const iso = (s) => parseParisInput(s).toISOString();
const ev = (id, start, end) => ({ id, title: `e${id}`, start_at: iso(start), end_at: iso(end) });

test('semaine : lundi et numéro ISO', () => {
  assert.equal(weekStartKey('2026-10-11'), '2026-10-05');
  assert.equal(weekStartKey('2026-10-05'), '2026-10-05');
  assert.equal(isoWeek('2026-10-05'), 41);
  assert.equal(isoWeek('2026-01-01'), 1);
});

test('planning : voies et zone de conflit', () => {
  const p = buildPlanning([
    ev(1, '2026-10-11T10:00', '2026-10-11T18:00'),
    ev(2, '2026-10-11T15:00', '2026-10-11T17:00'),
    ev(3, '2026-10-06T14:00', '2026-10-06T16:00'),
  ], '2026-10-05');
  const sunday = p.days[6];
  assert.equal(sunday.name, 'dimanche');
  assert.equal(sunday.lanes, 2);
  assert.deepEqual(sunday.items.map((i) => i.lane), [0, 1]);
  assert.equal(sunday.conflicts.length, 1);
  assert.equal(sunday.conflicts[0].label, '15\u00a0h\u00a0– 17\u00a0h');
  assert.equal(p.days[1].conflicts.length, 0);
  assert.equal(p.conflictCount, 1);
});

test('planning : événements qui se suivent sans se chevaucher', () => {
  const p = buildPlanning([ev(1, '2026-10-07T10:00', '2026-10-07T12:00'), ev(2, '2026-10-07T12:00', '2026-10-07T14:00')], '2026-10-05');
  assert.equal(p.days[2].lanes, 1);
  assert.equal(p.days[2].conflicts.length, 0);
});

test('planning : plage horaire élargie pour un événement tardif', () => {
  const p = buildPlanning([ev(1, '2026-10-09T21:00', '2026-10-10T01:00')], '2026-10-05');
  assert.equal(p.maxHour, 24);
  assert.equal(p.days[4].items.length, 1);
  assert.equal(p.days[5].items.length, 1);
});

test('pages agenda : semaine, mois, navigation', async () => {
  const { app, models } = setup();
  const u = makeUser(models, 'u');
  const a = makeAsso(models, u, 'Club');
  makeEvent(models, a, u, 1, '10:00', '12:00', { title: 'Réunion du club' });
  const c = await client(app);
  const week = await c.get('/evenements');
  assert.equal(week.status, 200);
  assert.match(week.text, /Semaine \d+/);
  assert.equal((await c.get('/evenements?semaine=2026-10-11')).status, 200);
  assert.equal((await c.get('/evenements/mois')).status, 200);
  const home = await c.get('/');
  assert.match(home.text, /Planning de la semaine/);
});
