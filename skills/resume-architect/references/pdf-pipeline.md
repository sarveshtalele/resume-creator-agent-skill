# PDF Pipeline

Markdown is the editable source of truth. The PDF is a build artifact produced only after Gate B, and it is always regenerated from the current Markdown — never hand-edited.

## Stages

```
resume.md ──▶ lint-resume.js ──▶ md-to-pdf.js ──▶ resume.html ──▶ engine ──▶ resume.pdf ──▶ page-count check
```

1. **Validate.** `scripts/lint-resume.js` must exit 0 first. Rendering an invalid file wastes the candidate's review.
2. **Render HTML.** `scripts/md-to-pdf.js` converts the Markdown dialect to single-column HTML and inlines `assets/resume.css`, which sets the page box, margins, and type scale.
3. **Print.** The first available engine wins: Chrome/Chromium/Edge headless, then wkhtmltopdf, then weasyprint.
4. **Verify.** The script counts pages in the produced PDF and warns when the count is above one.

## Command

```bash
node scripts/md-to-pdf.js resume-out/<slug>/resume.md \
  -o resume-out/<slug>/resume.pdf --format Letter --json
```

Options: `--format Letter|A4`, `--engine auto|chrome|wkhtmltopdf|weasyprint`, `--css <file>`, `--html-only`, `--json`.

`--json` returns `{ input, html, pdf, engine, bytes, pages, format }` — read `pages` and act on it rather than assuming the render fit.

## Engine notes

| Engine | Detection | Notes |
|:--|:--|:--|
| Chrome family | Standard install paths per platform, then `PATH`; override with the `RESUME_CHROME` environment variable | Best fidelity for the flex-based date alignment. Runs headless with a throwaway profile directory |
| wkhtmltopdf | `PATH` | Older engine; flex alignment degrades to left-aligned dates but text stays selectable |
| weasyprint | `PATH` | Good CSS paged-media support; slower start |

Exit codes: `0` success, `2` bad input, `3` no engine found, `4` engine ran but produced nothing usable.

## Estimator accuracy

The validator's page-fill percentage was calibrated against real Chrome output across 24 resume variants of increasing length. Measured behaviour on Letter:

- Every document estimated at 100% or below rendered to exactly one page.
- Documents still fit at estimates up to 102%.
- Overflow to two pages first appeared at an estimate of 104%.

So the estimate runs 2–4 points pessimistic, which is the safe direction: it never passed a document that then spilled. Treat the 100% threshold as a hard line anyway — font substitution on a different machine consumes that margin.

## When the PDF spills to two pages

The estimator is close but not exact — font substitution and long unbroken tokens shift it. Fix in this order, re-rendering after each step:

1. Cut the last bullet from the oldest role.
2. Shorten any bullet that wraps with fewer than four words on its second line.
3. Reduce the summary to two sentences.
4. Merge two Skills rows.

Layout knobs are the last resort, and only inside these bounds: body text no smaller than 10pt, page margin no tighter than 0.4in.

## Verifying the output is ATS-readable

```bash
pdftotext -layout resume-out/<slug>/resume.pdf - | head -40
```

Read the text back and confirm: the name is the first line, the contact line survived intact, section headings appear in order, each company sits above its title, and every date range is present. If the text comes back empty, the PDF is image-based — that means the wrong engine ran, and the fix is re-rendering with Chrome rather than post-processing.

## Rebuilding after edits

Any change to `resume.md` — from either side of the conversation — invalidates both `resume.html` and `resume.pdf`. Re-run the validator, then re-render. Both files are safe to regenerate at any time.
