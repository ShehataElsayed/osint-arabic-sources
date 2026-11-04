import tempfile
import unittest
from newsroom.store import Store, Denied, Conflict


class TenantStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = self.tmp.name + '/db.sqlite'
        self.store = Store(self.path)
        self.a = self.store.bootstrap('مؤسسة ألف', 'alice')
        self.b = self.store.bootstrap('مؤسسة باء', 'bob')
        self.f = self.store.create('alice', self.a, 'تحقيق', {'text': 'مصدر عربي'})

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def test_cross_tenant_denied_even_with_known_file_id(self):
        for principal, tenant in [('bob', self.a), ('bob', self.b)]:
            with self.assertRaises(Denied):
                self.store.read(principal, tenant, self.f)
            with self.assertRaises(Denied):
                self.store.save(principal, tenant, self.f, 1, {'text': 'bad'})

    def test_viewer_and_reviewer_cannot_write_or_grant(self):
        for role in ('viewer', 'reviewer'):
            self.store.member('alice', self.a, role, role)
            self.assertEqual(self.store.read(role, self.a, self.f)['content']['text'], 'مصدر عربي')
            with self.assertRaises(Denied):
                self.store.save(role, self.a, self.f, 1, {})
            with self.assertRaises(Denied):
                self.store.member(role, self.a, 'other', 'editor')

    def test_version_conflict_never_overwrites(self):
        self.store.member('alice', self.a, 'editor', 'editor')
        self.assertEqual(self.store.save('editor', self.a, self.f, 1, {'text': 'مراجعة'}), 2)
        with self.assertRaises(Conflict):
            self.store.save('alice', self.a, self.f, 1, {'text': 'lost update'})
        self.assertEqual(self.store.read('alice', self.a, self.f)['content']['text'], 'مراجعة')
        self.assertEqual(self.store.read('alice', self.a, self.f, 1)['content']['text'], 'مصدر عربي')
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM audit WHERE action='save'").fetchone()[0], 1)

    def test_backup_restore_retains_history_and_isolation(self):
        import sqlite3
        backup = sqlite3.connect(self.tmp.name + '/backup.sqlite')
        self.store.db.backup(backup)
        backup.close()
        restored = Store(self.tmp.name + '/backup.sqlite')
        try:
            self.assertEqual(restored.read('alice', self.a, self.f)['version'], 1)
            with self.assertRaises(Denied):
                restored.read('bob', self.b, self.f)
        finally:
            restored.db.close()
