const express = require('express');
const { CATEGORIES } = require('../lib/constants');
const { parseParisInput } = require('../lib/time');
const { contrast } = require('../lib/view-helpers');

module.exports = ({ models }) => {
  const router = express.Router();

  const isoOrNull = (value) => {
    const d = new Date(String(value || ''));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  /** Flux JSON consommé par FullCalendar. */
  router.get('/evenements', (req, res) => {
    const from = isoOrNull(req.query.start);
    const to = isoOrNull(req.query.end);
    if (!from || !to) return res.status(400).json({ error: 'Paramètres start et end requis.' });
    const events = models.events.list({
      user: req.user,
      from, to,
      associationSlug: String(req.query.association || ''),
      category: CATEGORIES[req.query.theme] ? req.query.theme : '',
      mine: req.query.mes === '1',
    }, { limit: 1000 });

    return res.json(events.map((e) => ({
      id: String(e.id),
      title: e.title,
      start: e.start_at,
      end: e.end_at,
      url: `/evenements/${e.id}`,
      backgroundColor: e.association_color,
      borderColor: e.association_color,
      textColor: contrast(e.association_color),
      classNames: e.visibility === 'network' ? ['ev-network'] : [],
      extendedProps: {
        association: e.association_name,
        location: e.location,
        visibility: e.visibility,
        volunteersNeeded: e.volunteers_needed,
        partners: e.nb_partners,
      },
    })));
  });

  /** Vérification en direct des conflits de créneau (formulaire d'événement). */
  router.get('/conflits', (req, res) => {
    const start = parseParisInput(req.query.start);
    const end = parseParisInput(req.query.end);
    if (!req.user || !start || !end || end <= start) return res.json([]);
    const conflicts = models.events.conflicts(start.toISOString(), end.toISOString(), Number(req.query.exclude) || 0);
    return res.json(conflicts.map((e) => ({
      id: e.id, title: e.title, association: e.association_name, color: e.association_color,
      location: e.location, start: e.start_at, end: e.end_at,
    })));
  });

  return router;
};
