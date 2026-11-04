# Osh Office implementation status

This is an early local-first editor increment, not Microsoft Office parity or a finished newsroom service.

Verified in app export/download/hub reimport tests:
- DOCX: Arabic headings, bold and italic text, a simple table, and an embedded PNG.
- XLSX: Arabic strings, two sheets, SUM and a quoted cross-sheet formula. Recomputed value checked after reimport.
- PPTX: Arabic text, font size/bold/font face/alignment, solid sRGB background, multiline speaker notes and text/image x/y/width/height. Slide sequence follows presentation relationships.
- Real entity extraction result opens in Sheets. Exact quote, source URL, and unreviewed status are retained. The complete shared-case JSON is stored as provenanceCase in the Office record and its JSON backup.

Not covered or not supported:
- DOCX page layout fidelity, tracked changes, comments, complex fields, advanced tables. Mammoth imports semantic content rather than exact Word layout.
- XLSX font/fill/border styles, charts and merges are not preserved. Column widths, row heights, boolean cells and number-format codes have fixture coverage; only a small set of common number formats render in the editor, while other codes are retained for export. Formulas are a subset with 10 explicit parser/regression tests, not all Excel functions verified.
- PPTX masters, themes, transitions, animations, grouped objects, imported shapes/tables are not yet preserved. Only solid sRGB backgrounds and simple text notes have fixture coverage, not theme-resolved colors or notes layout. Text/image geometry has fixture coverage only.
- Platform routing: 10 shared-case tools automatically save local Office copies and offer Open in Office. Successful summary results on 11 tool surfaces and structured entity/claim/event AI outputs also save typed Office copies with source/provider/unreviewed provenance. Validated assistant reports save Writer copies; keyword/semantic tool results and proposed research plans save Sheets copies with their discovery limitations. Late assistant RSS/fact panels save a separate discovery sheet, including service errors/no-match as unknown states, without replacing the editable report. Some legacy outputs remain unconnected; this is not every platform result.
- Account login, institution isolation, server storage, authorization/roles, simultaneous collaboration, audit trail, newsroom approval and publication workflow, and multi-device sync are not built in this increment.
- AI reuses deployed worker modes and free quotas. No worker deploy or model subscription is included.

Storage is per browser. Keep JSON backups. Clearing browser storage deletes local files. Sensitive content sent to AI is disclosed to the configured worker/model provider; review their policies.

RSS discovery uses conservative whole-token filtering, normalized Arabic articles, and generic question-word removal. Multiple topic terms need at least two matches. This can miss inflected names, synonyms, or useful single-term matches within longer questions; no semantic relevance or truth claim is made. Client-side filtering is more conservative on legacy responses without descriptions. Fact Check service authorization remains an external configuration dependency.

Native AI handlers now retain raw result/provider/source text/review history in local JSON, preserve ask decision/limits and full report in Writer or Slides notes, and show a persistent unreviewed banner. Malformed ask responses cannot be inserted. Writer appends explicit AI insertion; Sheets asks before replacing occupied cells. This is local provenance, not authenticated editorial approval, team audit, or automated truth verification.
