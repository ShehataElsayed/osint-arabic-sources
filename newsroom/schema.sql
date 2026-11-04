PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS institutions(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS members(tenant TEXT NOT NULL REFERENCES institutions(id),principal TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','editor','reviewer','viewer')),PRIMARY KEY(tenant,principal));
CREATE TABLE IF NOT EXISTS office_files(id TEXT PRIMARY KEY,tenant TEXT NOT NULL REFERENCES institutions(id),name TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('doc','sheet','deck','board')),version INTEGER NOT NULL CHECK(version>=1),updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS office_files_tenant ON office_files(tenant,updated_at);
CREATE TABLE IF NOT EXISTS file_versions(file_id TEXT NOT NULL REFERENCES office_files(id),version INTEGER NOT NULL,content TEXT NOT NULL,author TEXT NOT NULL,operation_id TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,PRIMARY KEY(file_id,version));
CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,tenant TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,file_id TEXT,version INTEGER,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS audit_tenant_time ON audit_events(tenant,created_at);

CREATE TABLE IF NOT EXISTS editorial_state(file_id TEXT PRIMARY KEY REFERENCES office_files(id),version INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('draft','in_review','approved','changes_requested','rejected')),reviewer TEXT,transition_id TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,tenant TEXT NOT NULL REFERENCES institutions(id),revision INTEGER NOT NULL,content TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crm_records(id TEXT PRIMARY KEY,tenant TEXT NOT NULL REFERENCES institutions(id),kind TEXT NOT NULL CHECK(kind IN ('actor','opportunity','activity','contract','ledger')),revision INTEGER NOT NULL CHECK(revision>=1),content TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS crm_tenant_kind ON crm_records(tenant,kind,updated_at);
CREATE TABLE IF NOT EXISTS crm_work_links(tenant TEXT NOT NULL REFERENCES institutions(id),record_id TEXT NOT NULL REFERENCES crm_records(id),workflow_id TEXT NOT NULL REFERENCES workflow_runs(id),created_at INTEGER NOT NULL,PRIMARY KEY(tenant,record_id,workflow_id));
CREATE TABLE IF NOT EXISTS crm_imports(tenant TEXT NOT NULL,source_hash TEXT NOT NULL,id TEXT NOT NULL,content TEXT NOT NULL,PRIMARY KEY(tenant,source_hash));
CREATE TABLE IF NOT EXISTS crm_import_guards(id TEXT PRIMARY KEY,passed INTEGER NOT NULL CHECK(passed=1));
CREATE TABLE IF NOT EXISTS work_orders(id TEXT PRIMARY KEY,tenant TEXT NOT NULL REFERENCES institutions(id),revision INTEGER NOT NULL,content TEXT NOT NULL);
