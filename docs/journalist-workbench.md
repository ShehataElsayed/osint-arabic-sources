# Non-AI journalist workbench

User pivot 28 October 2026: build all ten without AI now, defer AI. This page contains no model runtime or remote inference. Existing rejected private model work remains separate.

- Claims: exact-span sentence segmentation, number/negation spotting, human selection, evidence direction and notes.
- Entities: human-entered subject/relation/object, literal unique source quote and entity presence checks, graph.
- Timeline: date-pattern candidates, relative/ambiguous dates remain unresolved, valid ISO manual sort, editable event.
- Versions: exact line-LCS insert/delete/equal output, raw numeric and negation token lists. Not semantic difference.
- OCR: actual self-hosted Tesseract.js 5.1.1 + core 5.1.1, Arabic/English traineddata, original visible, raw text preserved. Synthetic test misreads ١٢ as ١١7. Mandatory original review.
- Translation: human-aligned translation with surface number/negation checks. No automatic translation.
- Image: actual local SHA-256, dimensions, JPEG/PNG structure read (markers, DQT quantization tables, approximate IJG quality estimate), EXIF/eXIf metadata (camera, software, dates, recorded GPS), client-side JPEG-90 recompression difference, local noise map, copy-move clone detection (quantized-DCT block matching after Fridrich et al., our implementation), luminance gradient, interactive level sweep, RGB histogram, embedded EXIF thumbnail comparison, and notable file strings as visual review clues, optional user-clicked Nominatim reverse lookup of recorded coordinates (coordinates only, with ODbL attribution), and user-supplied published-URL reverse-search links (Google Lens/TinEye/Yandex, no local upload). Metadata is editable and indicators are clues: no authenticity, manipulation, location or date verdicts.
- Video: actual four temporal sample frames, approximate browser offsets, per-frame JPEG download, raw report and human notes. No audio or authenticity detection; short events can be missed.
- Domain: actual URL parser and source-backed manually compiled dossier. Optional explicit Google Public DNS A lookup, with domain-only disclosure, timeout, source URL, raw response and timestamp. No automatic WHOIS. See https://developers.google.com/speed/public-dns/docs/doh/json . No network by default.
- Planner: fixed editable material-type plans with local tool routing and evidence notes. No autonomous research.

Immutable source snapshots and exact quote offsets remain with records. JSON import rejects mismatched quotes, malformed schema and unknown tool IDs. Plain-text export and JSON backup available. Per-tab input drafts stay in page memory while switching tools. No automatic persistence: download before closing. Local case text never uploaded. Package dependencies self-hosted.

Standalone page: site/image-analysis.html presents the same image analysis on the platform shell (own page per tool, no case-workbench chrome), no analytics on that page, zero default network. Tests: node --test tests/journalist-core.test.mjs tests/image-analysis.test.mjs; node tests/image-page.cjs; node tests/journalist-workbench.cjs (CHROME_PATH may override browser). Synthetic test fixtures are not news or verified sources.
Standalone page: site/domain-dossier.html presents the domain work on the platform shell (own page per tool): local URL decomposition plus optional explicit per-tool live lookups - Google Public DNS (domain only) and RDAP via rdap.org (domain only) - each behind its own button with disclosure, raw response and source URL; JSON dossier download; no analytics on that page; zero default network. Tests: node tests/domain-page.cjs. RDAP policy: https://rdap.org/ (free public service). Not a replacement for manual WHOIS/registrar judgment; DNS and registration data are operational clues, not attribution.
CSP note: domain-dossier.html allows connect-src https: because rdap.org redirects to per-TLD registry RDAP hosts that cannot be enumerated; the no-network-by-default guarantee is behavioral (no fetch without an explicit button click) and test-verified, while script/object/frame sources stay self-only.
Standalone page: site/video-frames.html presents the video frame work on the platform shell: local SHA-256 fingerprint, four temporal canvas frames with approximate browser offsets, per-frame JPEG download, human review notes and JSON record download; no audio, no vision analysis, no authenticity verdict; zero network on the page (CSP connect-src 'self' blob:). Tests: node tests/video-page.cjs.

## صفحة الخط الزمني التفاعلي (timeline.html)

صفحة مستقلة تبني خطًا زمنيًا تفاعليًا من نص يلصقه الصحفي: ترصد أنماط التواريخ الصريحة والعبارات النسبية عبر `dateCandidates` من journalist-core، ويعرض كل مرشح بطاقة مراجعة يؤكد فيها الصحفي التاريخ بصيغة ISO ويصيغ الحدث بنفسه. العبارات النسبية مثل «أمس» لا تُحوَّل آليًا بل تنتقل إلى مسار «غير محسوم» حتى يحسمها الصحفي. المحور SVG متجاوب باتجاه RTL (الأقدم يمينًا) مع تدرج علامات تلقائي، ونقر أي علامة يفتح لوحة تفاصيل تُظهر الاقتباس الأصلي والتعبير كما ورد. التصدير والاستيراد JSON (صيغة timeline-events-v1) محليان بالكامل، ولا يصدر عن الصفحة أي طلب شبكة. الاختبار: `node tests/timeline-page.cjs`.

## صفحة مقارنة النسخ (versions.html)

صفحة مستقلة تقارن نسختين يلصقهما الصحفي (بيان بين نشرتين، مسودتا اتفاق، مقال قبل التحرير وبعده). مقارنة سطرية بخوارزمية LCS مع إبراز الكلمات المعدلة داخل السطر الواحد، وإحصاءات (مطابق/معدل/مضاف/محذوف/نسبة تطابق)، وخيار تجاهل اختلاف المسافات، وتصدير JSON (صيغة versions-diff-v1). الحد الأقصى 800 سطر لكل نسخة. كل المعالجة محلية؛ لا تقارن مصادر على الويب ولا تتصل بالأرشيف. الاختبار: `node tests/versions-page.cjs`.
