# Yemen conflict map (prototype)

Page: `site/yemen.html` (+ `yemen.js`, `yemen.css`). Static, no server, no API keys.

## Data
| File | Source | License | Update |
|---|---|---|---|
| `site/data/yemen-events.json` | UCDP GED v26.1, Yemen, 2010 onward | CC BY 4.0 | Manual: `python3 scripts/build_yemen_data.py GEDEvent_v26_1.csv 26.1` after each UCDP release (yearly). |
| `site/data/yemen-news.json` | GDELT DOC 2.0 headline index | free, credit GDELT | Automatic every 3 hours: `.github/workflows/yemen-update.yml` |
| `site/data/yemen-cameras.json` | Verified public camera streams only | per owner | Manual, empty by policy until a lawful public stream is verified |

## Limits
- UCDP records only events with at least one death, and publishes with a lag. The newest event in the file is shown at the top of the page.
- Location precision 3 and 4 are district or governorate centroids. They are hidden by default so the heat map does not show false hot spots.
- Numbers are published estimates, not verification.
- Faster updates need UCDP Candidate events (monthly, API token from the UCDP maintainer, free) or another licensed source.
- Not used: ACLED (redistribution not permitted), Yemen Data Project (no written reuse license, district-level only), unsecured or hacked cameras (never).
