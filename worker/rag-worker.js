// Deploy entry: Cloudflare Workers module syntax allows only handler-shaped named exports
// (functions/classes), so the test-imported helpers live in rag-lib.js and this thin entry
// re-exports only the default fetch handler. wrangler.toml main = "rag-worker.js".
import handler from './rag-lib.js';
export default handler;
