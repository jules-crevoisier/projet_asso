PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  is_staff        INTEGER NOT NULL DEFAULT 0,
  calendar_token  TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS associations (
  id                 INTEGER PRIMARY KEY,
  name               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug               TEXT NOT NULL UNIQUE,
  category           TEXT NOT NULL DEFAULT 'autre',
  short_description  TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  website            TEXT NOT NULL DEFAULT '',
  address            TEXT NOT NULL DEFAULT '',
  color              TEXT NOT NULL DEFAULT '#34478a',
  is_validated       INTEGER NOT NULL DEFAULT 0,
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  association_id  INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  message         TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, association_id)
);

CREATE TABLE IF NOT EXISTS events (
  id                 INTEGER PRIMARY KEY,
  association_id     INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'autre',
  start_at           TEXT NOT NULL,
  end_at             TEXT NOT NULL,
  location           TEXT NOT NULL,
  visibility         TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'network')),
  volunteers_needed  INTEGER NOT NULL DEFAULT 0,
  material_needs     TEXT NOT NULL DEFAULT '',
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_events_range ON events (start_at, end_at);

CREATE TABLE IF NOT EXISTS participations (
  id              INTEGER PRIMARY KEY,
  event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  association_id  INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'participant',
  message         TEXT NOT NULL DEFAULT '',
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (event_id, association_id)
);

CREATE TABLE IF NOT EXISTS volunteers (
  id          INTEGER PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id              INTEGER PRIMARY KEY,
  association_id  INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  author_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL DEFAULT 'info',
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  is_closed       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS replies (
  id              INTEGER PRIMARY KEY,
  post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  association_id  INTEGER REFERENCES associations(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid      TEXT PRIMARY KEY,
  sess     TEXT NOT NULL,
  expires  INTEGER NOT NULL
);
