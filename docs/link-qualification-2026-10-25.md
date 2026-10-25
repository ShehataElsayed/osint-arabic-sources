# Link qualification pass — 2026-10-25

Scope: all 40 `unverifiedLink` entries in `2-data.json`. Method: live fetch of each
URL; classification into squatted/redirected, confirmed dead, verified alive, or
unconfirmed. Crawler limits respected — a fetch error alone never upgraded an
entry to dead.

## Squatted / redirected (deprecated, domain repurposed)
pub-db.com, websta.me, imgrab.com (casino spam), blinkx.com, hooktube.com,
filessoo.com, hubii.com

## Confirmed dead (deprecated)
liveleak.com, emporis.com, findthedata.com, hashes.org, securityfocus.com/bid,
facebook.com/live, Chrome extension elkadbdicdciddfkdpmaolomehalghio,
YouTube storyboard bookmarklet (dead ytplayer API), webcitation.org (page loads,
archiving service discontinued)

## Verified alive (flag cleared, lastChecked stamped)
belastingdienst.nl, bop.gov/inmateloc, influenceexplorer.com, brbpublications.com,
sg.ch handelsregister, jobster.com, jsnice.org, sandbox.pikker.ee,
everypolitician.org (project archive), buybindatabase.binbase.com (paid),
github.com/Med0-n/Midins_Titan-Osint_Tool, pep.org.ua (already deprecated entry,
description verified accurate)

## Unconfirmed — kept unverifiedLink, need a browser session or judgment call
- networksec.org/grabbho/block.txt (empty content)
- moonsearch.com (empty content)
- knowurl.com (loads, empty title — likely parked)
- 7photos.net (no content)
- mini-for-instagram.en.softonic.com (HTTP 412 — bot block, likely alive)
- tofo.me (no content)
- mypicsmap.com (404)
- archive.recapthelaw.org (crawler error — RECAP is a known Free Law Project
  service, likely bot-blocked)
- identifont.com (crawler error)
- ayichat.com (404)
- spark.com (domain-title-only page — likely parked)
- phenoelit.org/dpl/dpl.html (crawler error)

## Reconciled counts (40 unique flagged entries, exclusive buckets)
- 7 newly confirmed unsafe/squatted -> deprecated + linkUnsafe (outbound disabled)
- 7 newly confirmed dead -> deprecated (LiveLeak enriched with proper fields,
  Facebook Live Map, FindTheData, SecurityFocus, Hashes.org, removed Chrome
  extension, dead YouTube bookmarklet)
- 6 already-deprecated entries -> flag cleared after verification (Emporis,
  Ukraine PEP, WebCite, Jobster, JS NICE, MIDINS TITAN)
- 8 verified alive -> flag cleared (BIN Base, VAT Research, BOP Inmate Locator,
  Influence Explorer, BRB Public Records, EveryPolitician, sg.ch register,
  Pikker.ee Cuckoo)
- 5 already-deprecated, unconfirmed -> kept flagged + lastChecked
- 7 unconfirmed -> kept flagged + lastChecked
Total 40; remaining unverifiedLink = 12. 44 lastChecked stamps = 40 flagged
entries + 4 duplicate-URL sibling nodes (bop.gov x2, everypolitician.org,
brbpublications.com). The 7+9+16+12=44 figure in the first report counted
node patches, not unique entries.

## Note
3-review-queue.json is fully integrated: 1109/1109 URLs already exist in the
tree. The queue could be retired or regenerated as a diff of the tree; raised
to main.
