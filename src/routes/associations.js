const express = require('express');
const { requireAuth, requireStaff, forbidden, notFound } = require('../lib/http');
const { str, isEmail, isUrl, FormErrors } = require('../lib/forms');
const { CATEGORIES, COLORS } = require('../lib/constants');

module.exports = ({ models, perms }) => {
  const router = express.Router();

  function readForm(body) {
    const values = {
      name: str(body.name, 150),
      category: CATEGORIES[body.category] ? body.category : 'autre',
      short_description: str(body.short_description, 200),
      description: str(body.description, 5000),
      email: str(body.email, 200),
      phone: str(body.phone, 30),
      website: str(body.website, 300),
      address: str(body.address, 255),
      color: COLORS.includes(body.color) ? body.color : '',
    };
    const errors = new FormErrors()
      .require('name', values.name)
      .require('short_description', values.short_description, 'Décrivez votre association en une phrase.');
    if (values.email && !isEmail(values.email)) errors.add('email', 'Adresse e-mail invalide.');
    if (values.website && !/^https?:\/\//.test(values.website)) values.website = `https://${values.website}`;
    if (values.website && !isUrl(values.website)) errors.add('website', 'Adresse web invalide.');
    return { values, errors };
  }

  const load = (req) => {
    const association = models.associations.bySlug(req.params.slug);
    if (!association) throw notFound('Association introuvable.');
    return association;
  };

  router.get('/', (req, res) => {
    const q = str(req.query.q, 100);
    const category = CATEGORIES[req.query.categorie] ? req.query.categorie : '';
    res.page('associations/list', {
      title: 'Associations',
      associations: models.associations.list({ q, category }),
      q, category,
    });
  });

  router.get('/nouvelle', requireAuth, (req, res) => {
    res.page('associations/form', { title: 'Inscrire une association', values: { color: '' }, errors: {}, association: null });
  });

  router.post('/nouvelle', requireAuth, (req, res) => {
    const { values, errors } = readForm(req.body);
    if (values.name && models.associations.list().some((a) => a.name.toLowerCase() === values.name.toLowerCase())) {
      errors.add('name', 'Une association porte déjà ce nom.');
    }
    if (errors.any) {
      return res.status(422).page('associations/form', { title: 'Inscrire une association', values, errors: errors.fields, association: null });
    }
    const association = models.associations.create(values, req.user.id, Boolean(req.user.is_staff));
    req.flash(association.can_publish ? 'success' : 'info', association.can_publish
      ? `« ${association.name} » est inscrite.`
      : `« ${association.name} » est inscrite. Un modérateur va la valider ; vous pourrez ensuite publier événements et annonces.`);
    return res.redirect(`/associations/${association.slug}`);
  });

  router.get('/moderation', requireStaff, (req, res) => {
    res.page('associations/moderation', { title: 'Modération', pending: models.associations.pending() });
  });

  router.get('/:slug', (req, res) => {
    const association = load(req);
    const membership = req.user ? models.memberships.get(req.user.id, association.id) : null;
    res.page('associations/detail', {
      title: association.name,
      association,
      membership,
      isAdmin: perms.isAdmin(req.user, association.id),
      events: models.events.list({ user: req.user, associationSlug: association.slug, past: false }, { limit: 8 }),
      members: req.user ? models.memberships.activeMembers(association.id) : [],
      posts: req.user ? models.posts.list({ associationId: association.id, limit: 5 }) : [],
    });
  });

  router.get('/:slug/modifier', requireAuth, (req, res) => {
    const association = load(req);
    if (!perms.isAdmin(req.user, association.id)) throw forbidden();
    res.page('associations/form', { title: `Modifier ${association.name}`, values: association, errors: {}, association });
  });

  router.post('/:slug/modifier', requireAuth, (req, res) => {
    const association = load(req);
    if (!perms.isAdmin(req.user, association.id)) throw forbidden();
    const { values, errors } = readForm(req.body);
    if (!values.color) values.color = association.color;
    const clash = models.associations.list().find((a) => a.id !== association.id && a.name.toLowerCase() === values.name.toLowerCase());
    if (clash) errors.add('name', 'Une association porte déjà ce nom.');
    if (errors.any) {
      return res.status(422).page('associations/form', { title: `Modifier ${association.name}`, values, errors: errors.fields, association });
    }
    models.associations.update(association.id, values);
    req.flash('success', 'Fiche mise à jour.');
    return res.redirect(`/associations/${association.slug}`);
  });

  router.post('/:slug/rejoindre', requireAuth, (req, res) => {
    const association = load(req);
    if (models.memberships.get(req.user.id, association.id)) {
      req.flash('info', 'Vous avez déjà une demande ou une adhésion pour cette association.');
    } else {
      models.memberships.request(req.user.id, association.id, str(req.body.message, 300));
      req.flash('success', 'Demande envoyée. Un responsable de l’association va la valider.');
    }
    res.redirect(`/associations/${association.slug}`);
  });

  router.post('/:slug/quitter', requireAuth, (req, res) => {
    const association = load(req);
    const m = models.memberships.get(req.user.id, association.id);
    if (m) {
      const lastAdmin = m.role === 'admin' && m.status === 'active' && models.memberships.adminCount(association.id) === 1;
      if (lastAdmin && models.memberships.activeCount(association.id) > 1) {
        req.flash('error', 'Vous êtes le seul responsable : nommez-en un autre avant de partir.');
        return res.redirect(`/associations/${association.slug}`);
      }
      models.memberships.remove(m.id);
      req.flash('success', m.status === 'pending' ? 'Demande annulée.' : `Vous avez quitté « ${association.name} ».`);
    }
    return res.redirect(`/associations/${association.slug}`);
  });

  router.get('/:slug/membres', requireAuth, (req, res) => {
    const association = load(req);
    if (!perms.isAdmin(req.user, association.id)) throw forbidden();
    res.page('associations/members', {
      title: `Membres – ${association.name}`, association, memberships: models.memberships.forAssociation(association.id),
    });
  });

  router.post('/:slug/membres/:id/:action', requireAuth, (req, res) => {
    const association = load(req);
    if (!perms.isAdmin(req.user, association.id)) throw forbidden();
    const m = models.memberships.byId(Number(req.params.id));
    if (!m || m.association_id !== association.id) throw notFound();
    const lastAdmin = m.role === 'admin' && m.status === 'active' && models.memberships.adminCount(association.id) === 1;

    switch (req.params.action) {
      case 'accepter':
        models.memberships.approve(m.id);
        req.flash('success', 'Membre accepté.');
        break;
      case 'promouvoir':
        models.memberships.setRole(m.id, 'admin');
        req.flash('success', 'Nouveau responsable nommé.');
        break;
      case 'retrograder':
        if (lastAdmin) req.flash('error', 'L’association doit garder au moins un responsable.');
        else { models.memberships.setRole(m.id, 'member'); req.flash('success', 'Rôle mis à jour.'); }
        break;
      case 'retirer':
        if (lastAdmin) req.flash('error', 'Impossible de retirer le dernier responsable.');
        else { models.memberships.remove(m.id); req.flash('success', m.status === 'pending' ? 'Demande refusée.' : 'Membre retiré.'); }
        break;
      default:
        throw notFound();
    }
    res.redirect(`/associations/${association.slug}/membres`);
  });

  router.post('/:slug/valider', requireStaff, (req, res) => {
    const association = load(req);
    models.associations.validate(association.id);
    req.flash('success', `« ${association.name} » est validée.`);
    res.redirect(req.get('referer')?.includes('/moderation') ? '/associations/moderation' : `/associations/${association.slug}`);
  });

  return router;
};
