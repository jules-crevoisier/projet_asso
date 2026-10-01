const session = require('express-session');

/** Stockage des sessions dans SQLite (évite une dépendance supplémentaire). */
class SqliteStore extends session.Store {
  constructor(db, { ttlMs = 1000 * 60 * 60 * 24 * 30 } = {}) {
    super();
    this.ttlMs = ttlMs;
    this.stmts = {
      get: db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?'),
      set: db.prepare('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires'),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      touch: db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      prune: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    };
    this.prune();
    this.timer = setInterval(() => this.prune(), 1000 * 60 * 60);
    this.timer.unref();
  }

  expiry(sess) {
    const cookieExpires = sess && sess.cookie && sess.cookie.expires;
    return cookieExpires ? new Date(cookieExpires).getTime() : Date.now() + this.ttlMs;
  }

  get(sid, cb) {
    try {
      const row = this.stmts.get.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb = () => {}) {
    try { this.stmts.set.run(sid, JSON.stringify(sess), this.expiry(sess)); cb(null); } catch (e) { cb(e); }
  }

  destroy(sid, cb = () => {}) {
    try { this.stmts.destroy.run(sid); cb(null); } catch (e) { cb(e); }
  }

  touch(sid, sess, cb = () => {}) {
    try { this.stmts.touch.run(this.expiry(sess), sid); cb(null); } catch (e) { cb(e); }
  }

  prune() { this.stmts.prune.run(Date.now()); }
}

module.exports = SqliteStore;
