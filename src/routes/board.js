const express = require('express');
const { requireAuth, forbidden, notFound } = require('../lib/http');
const { str, FormErrors } = require('../lib/forms');
const { POST_KINDS } = require('../lib/constants');

module.exports = ({ models, perms }) => {
  const router = express.Router();
  router.use(requireAuth);

  const load = (req) => {
    const post = models.posts.byId(Number(req.params.id));
    if (!post) throw notFound('Annonce introuvable.');
    return post;
  };

  function readForm(body) {
    const values = {
      association_id: Number(body.association_id) || 0,
      kind: POST_KINDS[body.kind] ? body.kind : 'info',
      title: str(body.title, 200),
      body: str(body.body, 10000),
    };
    const errors = new FormErrors().require('title', values.title).require('body', values.body);
    return { values, errors };
  }

  router.get('/', (req, res) => {
    const kind = POST_KINDS[req.query.type] ? req.query.type : '';
    const q = str(req.query.q, 100);
    const closed = req.query.cloturees === '1';
    res.page('board/list', { title: 'Annonces', posts: models.posts.list({ kind, q, closed }), kind, q, closed });
  });

  router.get('/nouvelle', (req, res) => {
    const associations = models.memberships.publishing(req.user.id);
    if (!associations.length) {
      req.flash('info', 'Pour publier une annonce, vous devez être membre d’une association validée.');
      return res.redirect('/associations');
    }
    return res.page('board/form', {
      title: 'Nouvelle annonce', post: null, associations, errors: {},
      values: { kind: POST_KINDS[req.query.type] ? req.query.type : 'info', association_id: associations[0].id },
    });
  });

  router.post('/nouvelle', (req, res) => {
    const associations = models.memberships.publishing(req.user.id);
    const { values, errors } = readForm(req.body);
    if (!associations.some((a) => a.id === values.association_id)) errors.add('association_id', 'Choisissez une de vos associations.');
    if (errors.any) return res.status(422).page('board/form', { title: 'Nouvelle annonce', post: null, associations, values, errors: errors.fields });
    const id = models.posts.create(values, req.user.id);
    req.flash('success', 'Annonce publiée.');
    return res.redirect(`/annonces/${id}`);
  });

  router.get('/:id', (req, res) => {
    const post = load(req);
    res.page('board/detail', {
      title: post.title,
      post,
      replies: models.posts.replies(post.id),
      canEdit: perms.canEditPost(req.user, post),
      myAssociations: models.memberships.userAssociations(req.user.id),
    });
  });

  router.get('/:id/modifier', (req, res) => {
    const post = load(req);
    if (!perms.canEditPost(req.user, post)) throw forbidden();
    res.page('board/form', { title: 'Modifier l’annonce', post, associations: [], values: post, errors: {} });
  });

  router.post('/:id/modifier', (req, res) => {
    const post = load(req);
    if (!perms.canEditPost(req.user, post)) throw forbidden();
    const { values, errors } = readForm(req.body);
    if (errors.any) return res.status(422).page('board/form', { title: 'Modifier l’annonce', post, associations: [], values, errors: errors.fields });
    models.posts.update(post.id, values);
    req.flash('success', 'Annonce mise à jour.');
    return res.redirect(`/annonces/${post.id}`);
  });

  router.post('/:id/cloturer', (req, res) => {
    const post = load(req);
    if (!perms.canEditPost(req.user, post)) throw forbidden();
    models.posts.toggleClosed(post.id);
    req.flash('success', post.is_closed ? 'Annonce rouverte.' : 'Annonce marquée comme résolue.');
    res.redirect(`/annonces/${post.id}`);
  });

  router.post('/:id/supprimer', (req, res) => {
    const post = load(req);
    if (!perms.canEditPost(req.user, post)) throw forbidden();
    models.posts.remove(post.id);
    req.flash('success', 'Annonce supprimée.');
    res.redirect('/annonces');
  });

  router.post('/:id/repondre', (req, res) => {
    const post = load(req);
    const body = str(req.body.body, 5000);
    let associationId = Number(req.body.association_id) || null;
    if (associationId && !perms.isMember(req.user, associationId)) associationId = null;
    if (body && !post.is_closed) models.posts.addReply(post.id, req.user.id, associationId, body);
    res.redirect(`/annonces/${post.id}#reponses`);
  });

  router.post('/reponses/:id/supprimer', (req, res) => {
    const reply = models.posts.replyById(Number(req.params.id));
    if (!reply) throw notFound();
    const post = models.posts.byId(reply.post_id);
    if (reply.author_id !== req.user.id && !perms.canEditPost(req.user, post)) throw forbidden();
    models.posts.removeReply(reply.id);
    res.redirect(`/annonces/${post.id}#reponses`);
  });

  return router;
};
