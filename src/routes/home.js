const express = require('express');
const { requireAuth } = require('../lib/http');
const { parseParisInput, parisDateKey } = require('../lib/time');

/** Minuit (heure de Paris) dans n jours, en ISO UTC. */
function startOfDay(days) {
  const d = new Date(`${parisDateKey()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return parseParisInput(`${d.toISOString().slice(0, 10)}T00:00`).toISOString();
}

module.exports = ({ models }) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    if (req.user) return res.redirect('/tableau-de-bord');
    return res.page('home', {
      title: 'Accueil',
      events: models.events.list({ past: false }, { limit: 7 }),
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
      week: models.events.list({ user, from: startOfDay(0), to: startOfDay(7) }, { limit: 300 }),
      posts: models.posts.list({ limit: 5 }),
      pending: models.memberships.pendingForAdmin(user.id),
      myPending: models.memberships.forUser(user.id).filter((m) => m.status === 'pending'),
      volunteering: models.events.userVolunteering(user.id),
    });
  });

  return router;
};
