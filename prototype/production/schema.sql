-- Account-scoped locks and relational records replace the single shared demo document.
CREATE TABLE IF NOT EXISTS hl_accounts (scope text PRIMARY KEY, payload jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS hl_identity (kind text NOT NULL, identity text NOT NULL, scope text NOT NULL REFERENCES hl_accounts(scope), PRIMARY KEY(kind,identity));
CREATE TABLE IF NOT EXISTS hl_control (id text PRIMARY KEY, payload jsonb NOT NULL DEFAULT '{}'::jsonb);
INSERT INTO hl_control(id) VALUES ('pairing') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS hl_records (kind text NOT NULL,id text NOT NULL,scope text NOT NULL REFERENCES hl_accounts(scope),payload jsonb NOT NULL,PRIMARY KEY(kind,id));
CREATE INDEX IF NOT EXISTS hl_records_owner ON hl_records(scope,kind);
CREATE INDEX IF NOT EXISTS hl_lot_match ON hl_records((payload->>'crop'),(payload->>'location'),(payload->>'grade'),(payload->>'harvestDate')) WHERE kind='lots';
CREATE TABLE IF NOT EXISTS hl_email_jobs (id text PRIMARY KEY,scope text NOT NULL REFERENCES hl_accounts(scope),destination text NOT NULL,subject text NOT NULL,body text NOT NULL,status text NOT NULL DEFAULT 'queued',attempts integer NOT NULL DEFAULT 0,next_at timestamptz NOT NULL DEFAULT now(),provider_receipt text,last_error text,updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS hl_email_due ON hl_email_jobs(next_at) WHERE status IN ('queued','retry');
