# RAG backend contract (draft)

POST BACKEND_URL (site/rag-config.js) with JSON {"question": "..."}.
Response: {"results":[{"title","publisher","url","claim","rating","date","text","fetch":"full|link_only","nli":{"contradiction":0..1}}]}.
- `text` is a snippet as the source API returns it; full text only where the source's terms/robots allow (`fetch":"full"`), otherwise `link_only`.
- Sources: Google Fact Check Tools (official key kept as a Worker secret), no other live source (Wikipedia removed at the owner's request). No scraping of Google. No AFP/Misbar/AraFacts corpus text.
- The page always shows validated_for_release=false.
