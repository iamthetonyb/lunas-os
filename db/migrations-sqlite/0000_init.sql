-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  name TEXT,
  role TEXT NOT NULL,
  preferred_lang TEXT DEFAULT 'EN',
  password_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Builders table
CREATE TABLE builders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL
);

-- Communities table
CREATE TABLE communities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  builder_id TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  FOREIGN KEY (builder_id) REFERENCES builders(id)
);

-- Services table
CREATE TABLE services (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit_kind TEXT
);

-- Model Plans table
CREATE TABLE model_plans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  builder_id TEXT,
  name TEXT NOT NULL,
  sqft INTEGER,
  tubs_count INTEGER DEFAULT 1,
  windows_count INTEGER,
  FOREIGN KEY (builder_id) REFERENCES builders(id)
);

-- Contract Rates table
CREATE TABLE contract_rates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  service_id TEXT NOT NULL,
  builder_id TEXT,
  community_id TEXT,
  model_plan_id TEXT,
  rate REAL NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (builder_id) REFERENCES builders(id),
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (model_plan_id) REFERENCES model_plans(id)
);

-- Crews table
CREATE TABLE crews (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  foreman_id TEXT,
  phone TEXT,
  FOREIGN KEY (foreman_id) REFERENCES users(id)
);

-- Blue Book Entries table
CREATE TABLE blue_book_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  builder_id TEXT,
  community_id TEXT,
  lot TEXT NOT NULL,
  service_id TEXT,
  model_plan_id TEXT,
  status TEXT DEFAULT 'PENDING',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (builder_id) REFERENCES builders(id),
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (model_plan_id) REFERENCES model_plans(id)
);
