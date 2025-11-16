CREATE TYPE org_role AS ENUM ('admin', 'backoffice', 'contractor');

CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'contractor',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_members_org_user_key UNIQUE (org_id, user_id)
);

CREATE TABLE service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  date date NOT NULL,
  project_name text,
  builder text,
  community text,
  address text,
  lot text,
  unit_lot text,
  service_type text,
  category text,
  status text,
  time_in time,
  time_out time,
  hours numeric(6,2),
  team text[],
  extras text,
  supervisor text,
  foreman text,
  crew_leader text,
  explain_work text,
  amount numeric(12,2),
  source text NOT NULL DEFAULT 'manual',
  photos text[],
  external_id text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_logs_org_date_idx ON service_logs (org_id, date);
CREATE UNIQUE INDEX service_logs_org_external_idx ON service_logs (org_id, external_id);

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'CUSTOMER';
