/** Erreurs HTTP et gardes de routes. */
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const forbidden = (msg = "Vous n'avez pas les droits pour effectuer cette action.") => httpError(403, msg);
const notFound = (msg = 'Introuvable.') => httpError(404, msg);

function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  req.flash('info', 'Connectez-vous pour continuer.');
  return res.redirect('/connexion');
}

function requireStaff(req, res, next) {
  if (req.user && req.user.is_staff) return next();
  return next(forbidden());
}

module.exports = { httpError, forbidden, notFound, requireAuth, requireStaff };
