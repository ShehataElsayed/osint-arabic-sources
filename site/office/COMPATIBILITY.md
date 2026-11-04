# Osh Office implementation status

This is an early local-first editor increment, not Microsoft Office parity or a finished newsroom service.

Verified in app export/download/hub reimport tests:
- DOCX: Arabic headings, bold and italic text, a simple table, and an embedded PNG.
- XLSX: Arabic strings, two sheets, SUM and a quoted cross-sheet formula. Recomputed value checked after reimport.
- PPTX: Arabic text, font size and bold, text/image x/y/width/height.
- Real entity extraction result opens in Sheets. Exact quote, source URL, and unreviewed status are retained. The complete shared-case JSON is stored as provenanceCase in the Office record and its JSON backup.

Not covered or not supported:
- DOCX page layout fidelity, tracked changes, comments, complex fields, advanced tables. Mammoth imports semantic content rather than exact Word layout.
- XLSX styles, charts, merges and dimensions are not yet preserved by the importer/exporter. Formulas are a subset with 10 explicit parser/regression tests, not all Excel functions verified.
- PPTX masters, themes, transitions, animations, grouped objects, imported shapes/tables and notes are not yet preserved. Text/image geometry has fixture coverage only.
- Platform routing: 10 shared-case tools automatically save local Office copies and offer Open in Office. Successful summary results on 11 tool surfaces and structured entity/claim/event AI outputs also save typed Office copies with source/provider/unreviewed provenance. Validated assistant reports save Writer copies; keyword/semantic tool results and proposed research plans save Sheets copies with their discovery limitations. Some legacy outputs remain unconnected; this is not every platform result.
- Account login, institution isolation, server storage, authorization/roles, simultaneous collaboration, audit trail, newsroom approval and publication workflow, and multi-device sync are not built in this increment.
- AI reuses deployed worker modes and free quotas. No worker deploy or model subscription is included.

Storage is per browser. Keep JSON backups. Clearing browser storage deletes local files. Sensitive content sent to AI is disclosed to the configured worker/model provider; review their policies.
