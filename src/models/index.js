const { hashPassword, randomToken } = require('../lib/security');
const { COLORS } = require('../lib/constants');

function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'association';
}

const now = () => new Date().toISOString();

/** Couche d'accès aux données. Toutes les requêtes SQL de l'application sont ici. */
function createModels(db, config) {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);

  // ---------- Utilisateurs ----------
  const users = {
    byId: (id) => one('SELECT * FROM users WHERE id = ?', id),
    byEmail: (email) => one('SELECT * FROM users WHERE email = ?', String(email).trim().toLowerCase()),
    byToken: (token) => one('SELECT * FROM users WHERE calendar_token = ?', token),
    create({ email, password, firstName, lastName, isStaff = false }) {
      const info = run(
        'INSERT INTO users (email, password_hash, first_name, last_name, is_staff, calendar_token) VALUES (?, ?, ?, ?, ?, ?)',
        String(email).trim().toLowerCase(), hashPassword(password), firstName.trim(), lastName.trim(), isStaff ? 1 : 0, randomToken(20),
      );
      return users.byId(info.lastInsertRowid);
    },
    update(id, { firstName, lastName, phone, bio }) {
      run('UPDATE users SET first_name = ?, last_name = ?, phone = ?, bio = ? WHERE id = ?', firstName, lastName, phone, bio, id);
    },
    setPassword: (id, password) => run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), id),
    regenerateToken: (id) => run('UPDATE users SET calendar_token = ? WHERE id = ?', randomToken(20), id),
  };

  // ---------- Associations & adhésions ----------
  const canPublish = (a) => Boolean(a && (a.is_validated || !config.requireValidation));
  const withFlags = (a) => (a ? { ...a, can_publish: canPublish(a) } : a);

  const associations = {
    canPublish,
    bySlug: (slug) => withFlags(one('SELECT * FROM associations WHERE slug = ?', slug)),
    byId: (id) => withFlags(one('SELECT * FROM associations WHERE id = ?', id)),
    list({ q = '', category = '' } = {}) {
      const where = [];
      const params = [];
      if (q) { where.push('(a.name LIKE ? OR a.short_description LIKE ? OR a.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      if (category) { where.push('a.category = ?'); params.push(category); }
      return all(`
        SELECT a.*, (SELECT COUNT(*) FROM memberships m WHERE m.association_id = a.id AND m.status = 'active') AS nb_members,
               (SELECT COUNT(*) FROM events e WHERE e.association_id = a.id AND e.end_at >= ?) AS nb_events
        FROM associations a ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY a.name COLLATE NOCASE`, now(), ...params).map(withFlags);
    },
    simpleList: () => all('SELECT id, name, slug, color FROM associations ORDER BY name COLLATE NOCASE'),
    create(data, userId, validated) {
      const base = slugify(data.name);
      let slug = base;
      for (let i = 2; one('SELECT 1 FROM associations WHERE slug = ?', slug); i += 1) slug = `${base}-${i}`;
      const count = one('SELECT COUNT(*) AS n FROM associations').n;
      const tx = db.transaction(() => {
        const info = run(`INSERT INTO associations (name, slug, category, short_description, description, email, phone, website, address, color, is_validated, created_by)
          VALUES (@name, @slug, @category, @short_description, @description, @email, @phone, @website, @address, @color, @validated, @userId)`,
        { ...data, slug, color: data.color || COLORS[count % COLORS.length], validated: validated ? 1 : 0, userId });
        run("INSERT INTO memberships (user_id, association_id, role, status) VALUES (?, ?, 'admin', 'active')", userId, info.lastInsertRowid);
        return info.lastInsertRowid;
      });
      return associations.byId(tx());
    },
    update(id, data) {
      run(`UPDATE associations SET name = @name, category = @category, short_description = @short_description, description = @description,
           email = @email, phone = @phone, website = @website, address = @address, color = @color WHERE id = @id`, { ...data, id });
    },
    validate: (id) => run('UPDATE associations SET is_validated = 1 WHERE id = ?', id),
    pending: () => all(`SELECT a.*, u.first_name, u.last_name, u.email AS creator_email FROM associations a
                        LEFT JOIN users u ON u.id = a.created_by WHERE a.is_validated = 0 ORDER BY a.created_at`),
    countValidated: () => one('SELECT COUNT(*) AS n FROM associations WHERE is_validated = 1').n,
    countPending: () => one('SELECT COUNT(*) AS n FROM associations WHERE is_validated = 0').n,
  };

  const memberships = {
    get: (userId, associationId) => one('SELECT * FROM memberships WHERE user_id = ? AND association_id = ?', userId, associationId),
    byId: (id) => one('SELECT * FROM memberships WHERE id = ?', id),
    forAssociation: (associationId) => all(`
      SELECT m.*, u.first_name, u.last_name, u.email, u.phone FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.association_id = ? ORDER BY m.status DESC, m.role, u.first_name`, associationId),
    activeMembers: (associationId) => all(`
      SELECT m.*, u.first_name, u.last_name FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.association_id = ? AND m.status = 'active' ORDER BY m.role, u.first_name`, associationId),
    forUser: (userId) => all(`
      SELECT m.*, a.name, a.slug, a.color, a.is_validated FROM memberships m JOIN associations a ON a.id = m.association_id
      WHERE m.user_id = ? ORDER BY a.name COLLATE NOCASE`, userId),
    /** Associations dont l'utilisateur est membre actif. */
    userAssociations(userId, { adminOnly = false } = {}) {
      return all(`SELECT a.* FROM associations a JOIN memberships m ON m.association_id = a.id
                  WHERE m.user_id = ? AND m.status = 'active' ${adminOnly ? "AND m.role = 'admin'" : ''}
                  ORDER BY a.name COLLATE NOCASE`, userId).map(withFlags);
    },
    publishing: (userId) => memberships.userAssociations(userId).filter((a) => a.can_publish),
    request: (userId, associationId, message) => run(
      'INSERT INTO memberships (user_id, association_id, message) VALUES (?, ?, ?)', userId, associationId, message,
    ),
    approve: (id) => run("UPDATE memberships SET status = 'active' WHERE id = ?", id),
    setRole: (id, role) => run('UPDATE memberships SET role = ? WHERE id = ?', role, id),
    remove: (id) => run('DELETE FROM memberships WHERE id = ?', id),
    adminCount: (associationId) => one("SELECT COUNT(*) AS n FROM memberships WHERE association_id = ? AND role = 'admin' AND status = 'active'", associationId).n,
    activeCount: (associationId) => one("SELECT COUNT(*) AS n FROM memberships WHERE association_id = ? AND status = 'active'", associationId).n,
    pendingForAdmin: (userId) => all(`
      SELECT m.*, u.first_name, u.last_name, u.email, a.name AS association_name, a.slug
      FROM memberships m JOIN users u ON u.id = m.user_id JOIN associations a ON a.id = m.association_id
      WHERE m.status = 'pending' AND m.association_id IN (
        SELECT association_id FROM memberships WHERE user_id = ? AND role = 'admin' AND status = 'active')
      ORDER BY m.created_at`, userId),
  };

  // ---------- Événements ----------
  const EVENT_SELECT = `SELECT e.*, a.name AS association_name, a.slug AS association_slug, a.color AS association_color,
    (SELECT COUNT(*) FROM volunteers v WHERE v.event_id = e.id) AS nb_volunteers,
    (SELECT COUNT(*) FROM participations p WHERE p.event_id = e.id) AS nb_partners
    FROM events e JOIN associations a ON a.id = e.association_id`;

  function eventFilters({ user, associationSlug, category, mine, from, to, past } = {}) {
    const where = [];
    const params = [];
    if (!user) where.push("e.visibility = 'public'");
    if (associationSlug) {
      where.push('(a.slug = ? OR e.id IN (SELECT p.event_id FROM participations p JOIN associations pa ON pa.id = p.association_id WHERE pa.slug = ?))');
      params.push(associationSlug, associationSlug);
    }
    if (category) { where.push('e.category = ?'); params.push(category); }
    if (mine && user) {
      const mineSql = "SELECT association_id FROM memberships WHERE user_id = ? AND status = 'active'";
      where.push(`(e.association_id IN (${mineSql}) OR e.id IN (SELECT event_id FROM participations WHERE association_id IN (${mineSql})))`);
      params.push(user.id, user.id);
    }
    if (from) { where.push('e.end_at > ?'); params.push(from); }
    if (to) { where.push('e.start_at < ?'); params.push(to); }
    if (past === true) { where.push('e.end_at < ?'); params.push(now()); }
    if (past === false) { where.push('e.end_at >= ?'); params.push(now()); }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  const events = {
    byId: (id) => one(`${EVENT_SELECT} WHERE e.id = ?`, id),
    list(filters = {}, { limit = 200, order = 'ASC' } = {}) {
      const { sql, params } = eventFilters(filters);
      return all(`${EVENT_SELECT} ${sql} ORDER BY e.start_at ${order === 'DESC' ? 'DESC' : 'ASC'} LIMIT ?`, ...params, limit);
    },
    conflicts(startIso, endIso, excludeId = 0) {
      return all(`${EVENT_SELECT} WHERE e.start_at < ? AND e.end_at > ? AND e.id != ? ORDER BY e.start_at`, endIso, startIso, excludeId);
    },
    create(data, userId) {
      const info = run(`INSERT INTO events (association_id, title, description, category, start_at, end_at, location, visibility, volunteers_needed, material_needs, created_by)
        VALUES (@association_id, @title, @description, @category, @start_at, @end_at, @location, @visibility, @volunteers_needed, @material_needs, @userId)`, { ...data, userId });
      return info.lastInsertRowid;
    },
    update(id, data) {
      run(`UPDATE events SET title = @title, description = @description, category = @category, start_at = @start_at, end_at = @end_at,
           location = @location, visibility = @visibility, volunteers_needed = @volunteers_needed, material_needs = @material_needs, updated_at = @now
           WHERE id = @id`, { ...data, id, now: now() });
    },
    remove: (id) => run('DELETE FROM events WHERE id = ?', id),
    countUpcoming: () => one('SELECT COUNT(*) AS n FROM events WHERE end_at >= ?', now()).n,
    feed({ publicOnly, userId, mine }) {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const filters = { user: publicOnly ? null : { id: userId }, mine, from: since };
      return events.list(filters, { limit: 2000 });
    },

    participations: (eventId) => all(`SELECT p.*, a.name, a.slug, a.color FROM participations p JOIN associations a ON a.id = p.association_id
                                      WHERE p.event_id = ? ORDER BY p.created_at`, eventId),
    participationById: (id) => one('SELECT * FROM participations WHERE id = ?', id),
    addParticipation: (eventId, associationId, kind, message, userId) => run(
      'INSERT INTO participations (event_id, association_id, kind, message, created_by) VALUES (?, ?, ?, ?, ?)', eventId, associationId, kind, message, userId,
    ),
    removeParticipation: (id) => run('DELETE FROM participations WHERE id = ?', id),

    volunteers: (eventId) => all(`SELECT v.*, u.first_name, u.last_name, u.email, u.phone FROM volunteers v JOIN users u ON u.id = v.user_id
                                  WHERE v.event_id = ? ORDER BY v.created_at`, eventId),
    isVolunteer: (eventId, userId) => Boolean(one('SELECT 1 FROM volunteers WHERE event_id = ? AND user_id = ?', eventId, userId)),
    toggleVolunteer(eventId, userId) {
      if (events.isVolunteer(eventId, userId)) {
        run('DELETE FROM volunteers WHERE event_id = ? AND user_id = ?', eventId, userId);
        return false;
      }
      run('INSERT INTO volunteers (event_id, user_id) VALUES (?, ?)', eventId, userId);
      return true;
    },
    userVolunteering: (userId) => all(`SELECT e.id, e.title, e.start_at FROM volunteers v JOIN events e ON e.id = v.event_id
                                       WHERE v.user_id = ? AND e.end_at >= ? ORDER BY e.start_at`, userId, now()),

    comments: (eventId) => all(`SELECT c.*, u.first_name, u.last_name FROM comments c JOIN users u ON u.id = c.user_id
                                WHERE c.event_id = ? ORDER BY c.created_at`, eventId),
    commentById: (id) => one('SELECT * FROM comments WHERE id = ?', id),
    addComment: (eventId, userId, body) => run('INSERT INTO comments (event_id, user_id, body) VALUES (?, ?, ?)', eventId, userId, body),
    removeComment: (id) => run('DELETE FROM comments WHERE id = ?', id),
  };

  // ---------- Annonces ----------
  const POST_SELECT = `SELECT p.*, a.name AS association_name, a.slug AS association_slug, a.color AS association_color, a.phone AS association_phone,
    u.first_name, u.last_name, u.email AS author_email,
    (SELECT COUNT(*) FROM replies r WHERE r.post_id = p.id) AS nb_replies
    FROM posts p JOIN associations a ON a.id = p.association_id LEFT JOIN users u ON u.id = p.author_id`;

  const posts = {
    byId: (id) => one(`${POST_SELECT} WHERE p.id = ?`, id),
    list({ kind = '', q = '', closed = false, associationId = 0, limit = 200 } = {}) {
      const where = [];
      const params = [];
      if (kind) { where.push('p.kind = ?'); params.push(kind); }
      if (q) { where.push('(p.title LIKE ? OR p.body LIKE ? OR a.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      if (!closed) where.push('p.is_closed = 0');
      if (associationId) { where.push('p.association_id = ?'); params.push(associationId); }
      return all(`${POST_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.created_at DESC LIMIT ?`, ...params, limit);
    },
    create: (data, userId) => run(
      'INSERT INTO posts (association_id, author_id, kind, title, body) VALUES (?, ?, ?, ?, ?)', data.association_id, userId, data.kind, data.title, data.body,
    ).lastInsertRowid,
    update: (id, data) => run('UPDATE posts SET kind = ?, title = ?, body = ?, updated_at = ? WHERE id = ?', data.kind, data.title, data.body, now(), id),
    toggleClosed: (id) => run('UPDATE posts SET is_closed = 1 - is_closed WHERE id = ?', id),
    remove: (id) => run('DELETE FROM posts WHERE id = ?', id),
    replies: (postId) => all(`SELECT r.*, u.first_name, u.last_name, a.name AS association_name FROM replies r
                              JOIN users u ON u.id = r.author_id LEFT JOIN associations a ON a.id = r.association_id
                              WHERE r.post_id = ? ORDER BY r.created_at`, postId),
    replyById: (id) => one('SELECT * FROM replies WHERE id = ?', id),
    addReply: (postId, userId, associationId, body) => run(
      'INSERT INTO replies (post_id, author_id, association_id, body) VALUES (?, ?, ?, ?)', postId, userId, associationId || null, body,
    ),
    removeReply: (id) => run('DELETE FROM replies WHERE id = ?', id),
  };

  // ---------- Réinitialisation de mot de passe ----------
  const passwordResets = {
    create: (tokenHash, userId, expiresAt) => {
      run('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?', userId, Date.now());
      run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', tokenHash, userId, expiresAt);
    },
    find: (tokenHash) => one('SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > ?', tokenHash, Date.now()),
    consume: (tokenHash) => run('DELETE FROM password_resets WHERE token_hash = ?', tokenHash),
  };

  return { db, users, associations, memberships, events, posts, passwordResets };
}

module.exports = { createModels, slugify };
