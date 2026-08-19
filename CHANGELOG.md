# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-20

First release.

### Added

- **`resume-architect` agent skill** — a six-phase workflow with two human approval gates
  that turns a job posting and a LinkedIn profile export into a tailored one-page resume.
- **Universal ATS template** — single column, reverse chronological, standard headings,
  company above title, `Mon YYYY – Mon YYYY` dates, no tables or images. Rationale and
  parser research in `references/ats-template.md`.
- **`lint-resume.js`** — validates the Markdown dialect for structure, ATS hygiene, and
  writing quality; estimates one-page fit before rendering; scores keyword coverage
  against the posting.
- **`md-to-pdf.js`** — renders the dialect to a text-selectable PDF through headless
  Chrome, wkhtmltopdf, or weasyprint, and reports the real page count of the file it
  produced.
- **`extract-linkedin.js`** — converts an exported LinkedIn profile PDF to clean text via
  `pdftotext` or `mutool`, with a documented fallback when neither is installed.
- **npx installer** — project-scoped and global installation, `list`, `where`, and
  `uninstall`, with no clobbering of an existing install unless forced.
- **19 end-to-end tests** covering bundle integrity, both validator paths, HTML structure,
  Letter and A4 rendering, overflow detection, PDF text extraction in document order, and
  the installer.
- **Documentation** — user guide, architecture, token economy, evaluation, troubleshooting,
  and reproducible measurement and diagram tooling.

### Verified

- evaluator-skill audit: **96.0 / 100, PASS** — 100 on every dimension the skill controls,
  0 security findings across 68 patterns, 37/37 functional assertions.
- Page-fit model calibrated against real Chrome output across 24 length variants: nothing
  the validator accepted rendered as more than one page.
