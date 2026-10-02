const express = require('express');
const { requireAuth } = require('../lib/http');
const { weekStartKey, addDays, parisMidnight, isoWeek } = require('../lib/time');
const { buildPlanning } = require('../lib/planning');

function currentWeek(models, user) {
  const start = weekStartKey();
  const events = models.events.list({ user, from: parisMidnight(start), to: parisMidnight(addDays(start, 7)) }, { limit: 500 });
  return { planning: buildPlanning(events, start), weekList: events, weekStart: start, weekEnd: addDays(start, 6), weekNumber: isoWeek(start), weekEvents: events.length };
}

module.exports = ({ models }) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    if (req.user) return res.redirect('/tableau-de-bord');
    return res.page('home', {
      title: 'Accueil',
      ...currentWeek(models, null),
      stats: {
        associations: models.associations.countValidated(),
        events: models.events.countUpcoming(),
      },
    });
  });

  router.get('/tableau-de-bord', requireAuth, (req, res) => {
    const user = req.user;
    const mine = models.memberships.userAssociations(user.id);
    res.page('dashboard', {
      title: 'Tableau de bord',
      myAssociations: mine,
      myEvents: mine.length ? models.events.list({ user, mine: true, past: false }, { limit: 6 }) : [],
      upcoming: models.events.list({ user, past: false }, { limit: 6 }),
      ...currentWeek(models, user),
      posts: models.posts.list({ limit: 5 }),
      pending: models.memberships.pendingForAdmin(user.id),
      myPending: models.memberships.forUser(user.id).filter((m) => m.status === 'pending'),
      volunteering: models.events.userVolunteering(user.id),
    });
  });

  return router;
};
