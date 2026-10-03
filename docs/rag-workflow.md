# RAG verification workflow (design, not validated)

1. Open search (backend): Static fact-check index (claimreview-data) plus Google Fact Check Tools once a key exists. Wikipedia is not used. No Google scraping.
2. Fact Check Tools (Google, official key as Worker secret): look for existing fact-checks of the claim; show publisher, rating, date, link, snippet.
3. If already fact-checked: apply rag-core stages (type, similarity, contradiction, answer/abstain). Output: snippet + link, labelled not validated.
4. If not fact-checked: guided checklist, not an automatic verdict.
   Automatable: claim type, entity/date extraction, earliest-found-source ordering from search dates, EXIF/metadata read in the browser, keyframe extraction.
   Needs a human: reverse image search review, source authenticity, geolocation and chronolocation (shadows, landmarks, weather), contacting the source, final judgement.
Every output carries validated_for_release=false. No "100%" claims.

## Model-answer gate (design, not validated)
The Worker `verify` mode sends only the user's question to an external AI service, never index text or publisher text. A JS port of the NewsRAG decision rules then gates the model's own answer:
- three independent samples, abstain when the majority verdict is below 60% agreement or is "uncertain";
- a second critic pass scoring contradiction, abstain at 0.5 or higher;
- claim-type rule: numeric, health and attribution claims need unanimous samples;
- recency flag from the model, abstain when set;
- the page cross-checks the verdict against published ratings kept on the device and abstains on conflict.
Limits: this is not the Python library and has no trained NLI; the critic is a model self-critique. Model memory is not evidence, so an answer is always labelled as model knowledge, and `validated_for_release=false` stays. No accuracy figure applies to this gate.
