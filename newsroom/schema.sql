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
