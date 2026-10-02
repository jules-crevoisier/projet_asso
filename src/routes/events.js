const express = require('express');
const { requireAuth, forbidden, notFound } = require('../lib/http');
const { str, int, FormErrors } = require('../lib/forms');
const { CATEGORIES, PARTICIPATION_KINDS } = require('../lib/constants');
const { parseParisInput, toParisInput, weekStartKey, addDays, parisMidnight, isoWeek, parisDateKey } = require('../lib/time');
const { buildPlanning } = require('../lib/planning');
const { buildCalendar } = require('../lib/ical');

module.exports = ({ models, perms, config }) => {
  const router = express.Router();

  const load = (req) => {
    const event = models.events.byId(Number(req.params.id));
    if (!event) throw notFound('Événement introuvable.');
    return event;
  };

  function readFilters(req) {
    return {
      association: str(req.query.association, 100),
      theme: CATEGORIES[req.query.theme] ? req.query.theme : '',
      mes: req.user && req.query.mes === '1' ? '1' : '',
    };
  }

  function readForm(body) {
    const start = parseParisInput(body.start);
    const end = parseParisInput(body.end);
    const values = {
      association_id: Number(body.association_id) || 0,
      title: str(body.title, 200),
      description: str(body.description, 10000),
      category: CATEGORIES[body.category] ? body.category : 'autre',
      start: str(body.start, 16),
      end: str(body.end, 16),
      location: str(body.location, 255),
      visibility: body.visibility === 'network' ? 'network' : 'public',
      volunteers_needed: Math.min(int(body.volunteers_needed), 999),
      material_needs: str(body.material_needs, 2000),
    };
    const errors = new FormErrors()
      .require('title', values.title)
      .require('location', values.location)
      .require('description', values.description);
    if (!start) errors.add('start', 'Date de début invalide.');
    if (!end) errors.add('end', 'Date de fin invalide.');
    if (start && end && end <= start) errors.add('end', 'La fin doit être après le début.');
    values.start_at = start ? start.toISOString() : null;
    values.end_at = end ? end.toISOString() : null;
    return { values, errors };
  }

  const baseUrl = (req) => config.baseUrl || `${req.protocol}://${req.get('host')}`;
  const sendIcs = (req, res, events, name, filename) => {
    res.type('text/calendar; charset=utf-8');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buildCalendar(events, { name, baseUrl: baseUrl(req), host: req.hostname }));
  };

  // ----- Planning de la semaine (vue principale), mois et liste -----
  router.get('/', (req, res) => {
    const filters = readFilters(req);
    const asked = /^\d{4}-\d{2}-\d{2}$/.test(req.query.semaine || '') ? req.query.semaine : parisDateKey();
    const start = weekStartKey(asked);
    const events = models.events.list({
      user: req.user, associationSlug: filters.association, category: filters.theme, mine: Boolean(filters.mes),
      from: parisMidnight(start), to: parisMidnight(addDays(start, 7)),
    }, { limit: 500 });
    res.page('events/week', {
      title: 'Agenda',
      filters,
      associations: models.associations.simpleList(),
      planning: buildPlanning(events, start),
      weekStart: start,
      weekEnd: addDays(start, 6),
      weekNumber: isoWeek(start),
      prevWeek: addDays(start, -7),
      nextWeek: addDays(start, 7),
      isCurrentWeek: start === weekStartKey(),
      weekEvents: events.length,
      weekList: events,
    });
  });

  router.get('/mois', (req, res) => {
    res.page('events/calendar', {
      title: 'Agenda du mois',
      scripts: ['/vendor/fullcalendar/index.global.min.js', '/vendor/fullcalendar-locales/fr.global.min.js', '/static/js/calendar.js'],
      filters: readFilters(req),
      associations: models.associations.simpleList(),
      initialDate: /^\d{4}-\d{2}(-\d{2})?$/.test(req.query.date || '') ? req.query.date : '',
    });
  });

  router.get('/liste', (req, res) => {
    const filters = readFilters(req);
    const past = req.query.passes === '1';
    res.page('events/list', {
      title: past ? 'Événements passés' : 'Événements à venir',
      filters,
      past,
      associations: models.associations.simpleList(),
      events: models.events.list(
        { user: req.user, associationSlug: filters.association, category: filters.theme, mine: Boolean(filters.mes), past },
        { order: past ? 'DESC' : 'ASC' },
      ),
    });
  });

  // ----- Flux iCal -----
  router.get('/ical/public.ics', (req, res) => {
    sendIcs(req, res, models.events.feed({ publicOnly: true }), `${config.platformName} – événements publics`, 'evenements-publics.ics');
  });

  router.get('/ical/:token.ics', (req, res) => {
    const user = models.users.byToken(req.params.token);
    if (!user) throw notFound();
    const mine = req.query.mes === '1';
    sendIcs(req, res, models.events.feed({ userId: user.id, mine }), `${config.platformName} – ${mine ? 'mes associations' : 'calendrier partagé'}`, 'calendrier-associations.ics');
  });

  // ----- Création / édition -----
  function renderForm(res, { event, values, errors, associations, conflicts = [], status = 200 }) {
    res.status(status).page('events/form', {
      title: event ? `Modifier « ${event.title} »` : 'Nouvel événement', event, values, errors, associations, conflicts,
      scripts: ['/static/js/event-form.js'],
    });
  }

  router.get('/nouveau', requireAuth, (req, res) => {
    const associations = models.memberships.publishing(req.user.id);
    if (!associations.length) {
      req.flash('info', 'Pour publier un événement, vous devez être membre d’une association validée.');
      return res.redirect('/associations');
    }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : '';
    const values = {
      association_id: associations[0].id, category: 'autre', visibility: 'public', volunteers_needed: 0,
      start: day ? `${day}T14:00` : '', end: day ? `${day}T18:00` : '',
    };
    return renderForm(res, { event: null, values, errors: {}, associations });
  });

  router.post('/nouveau', requireAuth, (req, res) => {
    const associations = models.memberships.publishing(req.user.id);
    const { values, errors } = readForm(req.body);
    if (!associations.some((a) => a.id === values.association_id)) errors.add('association_id', 'Choisissez une de vos associations.');
    if (errors.any) return renderForm(res, { event: null, values, errors: errors.fields, associations, status: 422 });

    const conflicts = models.events.conflicts(values.start_at, values.end_at);
    if (conflicts.length && req.body.confirm !== '1') {
      return renderForm(res, { event: null, values, errors: {}, associations, conflicts });
    }
    const id = models.events.create(values, req.user.id);
    req.flash('success', 'Événement publié dans le calendrier partagé.');
    return res.redirect(`/evenements/${id}`);
  });

  router.get('/:id', (req, res) => {
    const event = load(req);
    if (event.visibility === 'network' && !req.user) {
      req.session.returnTo = req.originalUrl;
      req.flash('info', 'Cet événement est réservé aux associations du réseau. Connectez-vous pour le voir.');
      return res.redirect('/connexion');
    }
    const canEdit = perms.canEditEvent(req.user, event);
    const participations = models.events.participations(event.id);
    const mine = req.user ? models.memberships.publishing(req.user.id) : [];
    const takenIds = new Set([event.association_id, ...participations.map((p) => p.association_id)]);
    return res.page('events/detail', {
      title: event.title,
      event,
      canEdit,
      participations,
      myAssociationIds: new Set(mine.map((a) => a.id)),
      availableAssociations: mine.filter((a) => !takenIds.has(a.id)),
      comments: req.user ? models.events.comments(event.id) : [],
      volunteers: canEdit ? models.events.volunteers(event.id) : [],
      isVolunteer: req.user ? models.events.isVolunteer(event.id, req.user.id) : false,
      conflicts: req.user ? models.events.conflicts(event.start_at, event.end_at, event.id) : [],
    });
  });

  router.get('/:id/evenement.ics', (req, res) => {
    const event = load(req);
    if (event.visibility === 'network' && !req.user) throw notFound();
    sendIcs(req, res, [event], event.title, `evenement-${event.id}.ics`);
  });

  router.get('/:id/modifier', requireAuth, (req, res) => {
    const event = load(req);
    if (!perms.canEditEvent(req.user, event)) throw forbidden();
    const values = { ...event, start: toParisInput(event.start_at), end: toParisInput(event.end_at) };
    renderForm(res, { event, values, errors: {}, associations: [] });
  });

  router.post('/:id/modifier', requireAuth, (req, res) => {
    const event = load(req);
    if (!perms.canEditEvent(req.user, event)) throw forbidden();
    const { values, errors } = readForm(req.body);
    values.association_id = event.association_id;
    if (errors.any) return renderForm(res, { event, values, errors: errors.fields, associations: [], status: 422 });

    const slotChanged = values.start_at !== event.start_at || values.end_at !== event.end_at;
    const conflicts = slotChanged ? models.events.conflicts(values.start_at, values.end_at, event.id) : [];
    if (conflicts.length && req.body.confirm !== '1') {
      return renderForm(res, { event, values, errors: {}, associations: [], conflicts });
    }
    models.events.update(event.id, values);
    req.flash('success', 'Événement mis à jour.');
    return res.redirect(`/evenements/${event.id}`);
  });

  router.post('/:id/supprimer', requireAuth, (req, res) => {
    const event = load(req);
    if (!perms.canEditEvent(req.user, event)) throw forbidden();
    models.events.remove(event.id);
    req.flash('success', 'Événement supprimé.');
    res.redirect('/evenements');
  });

  // ----- Coordination -----
  router.post('/:id/participer', requireAuth, (req, res) => {
    const event = load(req);
    const associationId = Number(req.body.association_id);
    const kind = PARTICIPATION_KINDS[req.body.kind] ? req.body.kind : 'participant';
    const allowed = models.memberships.publishing(req.user.id).some((a) => a.id === associationId);
    const taken = associationId === event.association_id
      || models.events.participations(event.id).some((p) => p.association_id === associationId);
    if (!allowed || taken) {
      req.flash('error', 'Impossible d’associer cette association à l’événement.');
    } else {
      models.events.addParticipation(event.id, associationId, kind, str(req.body.message, 300), req.user.id);
      req.flash('success', 'Votre association est maintenant associée à l’événement.');
    }
    res.redirect(`/evenements/${event.id}`);
  });

  router.post('/participations/:id/supprimer', requireAuth, (req, res) => {
    const p = models.events.participationById(Number(req.params.id));
    if (!p) throw notFound();
    const event = models.events.byId(p.event_id);
    if (!perms.isMember(req.user, p.association_id) && !perms.canEditEvent(req.user, event)) throw forbidden();
    models.events.removeParticipation(p.id);
    req.flash('success', 'Participation retirée.');
    res.redirect(`/evenements/${event.id}`);
  });

  router.post('/:id/benevole', requireAuth, (req, res) => {
    const event = load(req);
    const now = models.events.toggleVolunteer(event.id, req.user.id);
    req.flash(now ? 'success' : 'info', now
      ? 'Merci ! Les organisateurs voient maintenant que vous êtes disponible.'
      : 'Vous n’êtes plus inscrit·e comme bénévole.');
    res.redirect(`/evenements/${event.id}`);
  });

  router.post('/:id/commentaires', requireAuth, (req, res) => {
    const event = load(req);
    const body = str(req.body.body, 5000);
    if (body) models.events.addComment(event.id, req.user.id, body);
    res.redirect(`/evenements/${event.id}#discussion`);
  });

  router.post('/commentaires/:id/supprimer', requireAuth, (req, res) => {
    const c = models.events.commentById(Number(req.params.id));
    if (!c) throw notFound();
    const event = models.events.byId(c.event_id);
    if (c.user_id !== req.user.id && !perms.canEditEvent(req.user, event)) throw forbidden();
    models.events.removeComment(c.id);
    res.redirect(`/evenements/${event.id}#discussion`);
  });

  return router;
};
