"""Tenant-scoped storage domain prototype. No HTTP/authentication/deployment yet.

principal is a verified user ID supplied by a future authentication adapter, never a
request-body user/tenant claim. The prototype is not a public API.
"""
import json
import sqlite3
import uuid


class Denied(PermissionError):
    pass


class Conflict(ValueError):
    pass


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS institutions(id TEXT PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS members(tenant TEXT REFERENCES institutions(id), user TEXT, role TEXT CHECK(role IN ('owner','editor','reviewer','viewer')), PRIMARY KEY(tenant,user));
        CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, tenant TEXT REFERENCES institutions(id), name TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS versions(file TEXT REFERENCES files(id), version INTEGER, content TEXT NOT NULL, author TEXT NOT NULL, PRIMARY KEY(file,version));
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, tenant TEXT, actor TEXT, action TEXT, file TEXT, version INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        ''')

    def _role(self, principal, tenant, allowed):
        row = self.db.execute('SELECT role FROM members WHERE tenant=? AND user=?', (tenant, principal)).fetchone()
        if not row or row[0] not in allowed:
            raise Denied('not permitted')
        return row[0]

    def bootstrap(self, name, owner):
        # Administrative provisioning only, not exposed to untrusted clients.
        tenant = str(uuid.uuid4())
        with self.db:
            self.db.execute('INSERT INTO institutions VALUES (?,?)', (tenant, name))
            self.db.execute('INSERT INTO members VALUES (?,?,?)', (tenant, owner, 'owner'))
        return tenant

    def member(self, principal, tenant, user, role):
        if role not in ('editor', 'reviewer', 'viewer'):
            raise ValueError('owner transfer is not supported by this prototype')
        with self.db:
            self._role(principal, tenant, ('owner',))
            old = self.db.execute('SELECT role FROM members WHERE tenant=? AND user=?', (tenant, user)).fetchone()
            if old and old[0] == 'owner':
                raise Denied('cannot replace owner')
            self.db.execute('INSERT INTO members VALUES (?,?,?) ON CONFLICT(tenant,user) DO UPDATE SET role=excluded.role', (tenant, user, role))
            self.db.execute('INSERT INTO audit(tenant,actor,action) VALUES (?,?,?)', (tenant, principal, 'member:'+user+':'+role))

    def create(self, principal, tenant, name, content):
        fid = str(uuid.uuid4())
        encoded = json.dumps(content, ensure_ascii=False)
        with self.db:
            self._role(principal, tenant, ('owner', 'editor'))
            self.db.execute('INSERT INTO files VALUES (?,?,?,1)', (fid, tenant, name))
            self.db.execute('INSERT INTO versions VALUES (?,1,?,?)', (fid, encoded, principal))
            self.db.execute('INSERT INTO audit(tenant,actor,action,file,version) VALUES (?,?,?,?,1)', (tenant, principal, 'create', fid))
        return fid

    def read(self, principal, tenant, fid, version=None):
        self._role(principal, tenant, ('owner', 'editor', 'reviewer', 'viewer'))
        row = self.db.execute('SELECT version FROM files WHERE id=? AND tenant=?', (fid, tenant)).fetchone()
        if not row:
            raise Denied('not permitted')
        version = row[0] if version is None else version
        row = self.db.execute('SELECT content FROM versions WHERE file=? AND version=?', (fid, version)).fetchone()
        if not row:
            raise ValueError('version not found')
        return {'version': version, 'content': json.loads(row[0])}

    def save(self, principal, tenant, fid, expected_version, content):
        encoded = json.dumps(content, ensure_ascii=False)
        with self.db:
            self._role(principal, tenant, ('owner', 'editor'))
            row = self.db.execute('SELECT version FROM files WHERE id=? AND tenant=?', (fid, tenant)).fetchone()
            if not row:
                raise Denied('not permitted')
            if row[0] != expected_version:
                raise Conflict('reload current version before saving')
            new = expected_version + 1
            changed = self.db.execute('UPDATE files SET version=? WHERE id=? AND tenant=? AND version=?', (new, fid, tenant, expected_version)).rowcount
            if changed != 1:
                raise Conflict('concurrent save')
            self.db.execute('INSERT INTO versions VALUES (?,?,?,?)', (fid, new, encoded, principal))
            self.db.execute('INSERT INTO audit(tenant,actor,action,file,version) VALUES (?,?,?,?,?)', (tenant, principal, 'save', fid, new))
        return new
