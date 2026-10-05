# How the verification experiment works (rag.html)

This document describes current behavior. Code: `worker/rag-worker.js` (Worker) and `site/rag.js` (page). Tests: `tests/rag-worker.test.mjs`.

## Principle

The tool always shows an **answer**, with a confidence level and its reasons. It does not refuse to answer and never says "verified". Model knowledge is not evidence; evidence is what was found on a page that was actually opened and passed the check.

## Stages

1. **Samples.** Three independent answers from an external model (temperature 0.7). Each has a verdict (`supported`, `refuted` or `uncertain`), an answer sentence, numbers and suggested sources.
2. **Consistency.** The majority verdict needs at least 0.6 agreement among samples and must not be `uncertain`.
3. **Claim type.** Numeric, health and attributed claims ("X said...") need unanimous samples, otherwise the criterion fails.
4. **Self-critique.** A fourth call rates the chance of contradiction from 0 to 1. 0.5 or higher fails the criterion.
5. **Recency.** If the model flags the topic as recent, a caveat is shown.
6. **Opening sources.** Every cited URL is fetched. One that does not open is shown as not opened, with no quote.
7. **Link repair.** For a failed link the Worker looks for a real page on the same domain: the sitemap (`sitemap.xml`, or a `Sitemap:` line in `robots.txt`) first, then a domain-restricted web search if a search key is set. A candidate is accepted only if it really opened. It is shown labeled "alternative link from the same domain" with the original URL. A guessed URL is never shown as opened.
8. **Search-found sources.** A web search for the claim itself (up to 3 pages after dropping blocked domains). They go through the same checks and are labeled as found by search, not by the model. Pages that fail to open are dropped.
9. **Page check.** The page is split into sentences. Each is compared with the claim by cosine similarity over words. A page counts as supporting if similarity is 0.4 or higher on a sentence of 6+ words and the numbers in the claim appear in the page text. A quote is shown at 0.15 or higher.
10. **Quote picking.** The Worker sends up to 10 short sentences from each opened source (up to 4 sources) to the model, which picks a sentence number. Only the number is accepted, so the displayed text is always a verbatim sentence of the page. These sentences come from public web pages and are the only exception to sending just the user's question to the model. No text from AFP, Misbar or AraFacts is sent.
11. **Tier and reliability.** Tiers (`official`, `news`, `academic`, `unknown`) are inferred from the domain. The "source reliability" rating comes from the tier and identity data. It rates the body, not the claim, and does not raise confidence alone.
12. **Identity.** RDAP lookup for the domain (age, registrar, registrant) and page signals (`og:site_name`, About and contact pages, HTTPS). A missing field shows as "not available".

## Confidence level

- **Low:** any criterion failed.
- **Medium:** no criterion failed, but no official, news or academic page was opened and passed the check.
- **High:** no criterion failed, and an official, news or academic page was opened and passed the check.

Caveats (the "!" marker) appear under the heading "caveats".

## Limits

- No accuracy evaluation on claims with known truth exists. No accuracy figure may be attributed to this tool. The 84.1 and 93.2 figures belong to the original NewsRAG library.
- The self-critique is a model reviewing itself, not a trained inference model.
- Lexical similarity catches matching words, not meaning, and can miss different phrasings.
- A domain name does not prove reliability. The tier is a general estimate.
- The free model and search quotas are limited. Cost per question: 4 core model calls (3 samples and the critique), up to 4 more for quote picking, one search call, and several page fetches.
- Every output carries `validated_for_release=false`.

## Worker modes

| Mode | Purpose |
|---|---|
| (default) | Google Fact Check Tools lookup when a key is set; snippet and link only |
| `verify` | The stages above |
| `recommend` | Recommends tools from the guide, plus unchecked external web-search links |
| `compose` | Writes a short sentence for the local result |
| `plan` | Turns a goal description into fields for the command builder, with no commands or links |

Full contract: [rag-backend-contract.md](rag-backend-contract.md).
