/** Règles d'accès, centralisées. */
function createPermissions(models) {
  const { memberships } = models;

  const isMember = (user, associationId) => {
    if (!user) return false;
    const m = memberships.get(user.id, associationId);
    return Boolean(m && m.status === 'active');
  };

  const isAdmin = (user, associationId) => {
    if (!user) return false;
    if (user.is_staff) return true;
    const m = memberships.get(user.id, associationId);
    return Boolean(m && m.status === 'active' && m.role === 'admin');
  };

  const canEditEvent = (user, event) => Boolean(user && (user.is_staff || isMember(user, event.association_id)));
  const canEditPost = (user, post) => Boolean(user && (user.is_staff || post.author_id === user.id || isMember(user, post.association_id)));

  return { isMember, isAdmin, canEditEvent, canEditPost };
}

module.exports = { createPermissions };
