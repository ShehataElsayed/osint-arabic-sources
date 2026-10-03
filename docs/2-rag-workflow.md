# RAG verification workflow (design, not validated)

1. Open search (backend): Static fact-check index (claimreview-data) plus Google Fact Check Tools once a key exists. Wikipedia is not used. No Google scraping.
2. Fact Check Tools (Google, official key as Worker secret): look for existing fact-checks of the claim; show publisher, rating, date, link, snippet.
3. If already fact-checked: apply rag-core stages (type, similarity, contradiction, answer/abstain). Output: snippet + link, labelled not validated.
4. If not fact-checked: guided checklist, not an automatic verdict.
   Automatable: claim type, entity/date extraction, earliest-found-source ordering from search dates, EXIF/metadata read in the browser, keyframe extraction.
   Needs a human: reverse image search review, source authenticity, geolocation and chronolocation (shadows, landmarks, weather), contacting the source, final judgement.
Every output carries validated_for_release=false. No "100%" claims.
