# Workflow Contract

The run is a state machine with two human gates. Phases never merge, and neither gate is ever assumed.

## Phases

| # | Phase | Enters when | Leaves when |
|:--|:--|:--|:--|
| 0 | Intake setup | The request arrives | Job description text and profile source are both in hand |
| 1 | Source parsing | Phase 0 done | Keywords and the fact base are written to disk |
| 2 | Interview | Phase 1 done | No blocking unknowns remain (max 3 rounds) |
| 3 | Plan | Phase 2 done | **Gate A**: the candidate approves the plan |
| 4 | Draft | Gate A passed | `resume.md` written and the validator reports zero errors |
| 5 | Revision | Draft delivered | **Gate B**: the candidate approves the Markdown |
| 6 | Render | Gate B passed | PDF exists, one page, path reported |

## Gate A — plan approval

The plan is prose, not a resume. It states the section order, which roles get how many bullets, the headline achievements chosen, keyword placement, what is being cut, and any coverage gaps. Ask plainly for approval and wait. Edits to the plan return to Phase 3; they do not advance.

## Gate B — Markdown approval

After the draft, point at the file path and invite edits. Two revision channels, both supported:

- The candidate edits `resume.md` directly in an editor, then says so. Re-read the file from disk before doing anything else — their edits are the newer truth.
- The candidate describes changes in chat. Apply them to the file.

Either way: re-run the validator after every change and report the new page fill. Loop until approval.

Approval means an explicit affirmative: "approve", "approved", "looks good, make the PDF", "ship it". Treat anything ambiguous — "nice", "ok I think", "sure, but…" — as not approved, and ask once, directly.

## Working directory

Create one folder per application under `resume-out/` in the current project:

```
resume-out/jane-doe-acme-senior-data-engineer/
├── notes.md          fact base: every claim with its source
├── keywords.txt      one keyword per line, extracted from the posting
├── plan.md           the Gate A artifact
├── resume.md         the deliverable the candidate reviews and edits
├── resume.html       build artifact, regenerated on every render
└── resume.pdf        final output
```

Slug format: `<first-last>-<company>-<role>`, lowercase, non-alphanumerics collapsed to hyphens. A second application for the same person gets its own folder; nothing is overwritten across applications.

## Commands at each phase

```bash
# Phase 1 — profile text (skip when reading the PDF with the agent's own reader)
node scripts/extract-linkedin.js ~/Downloads/Profile.pdf -o resume-out/<slug>/profile.txt

# Phase 4 and every revision — validate before showing anything
node scripts/lint-resume.js resume-out/<slug>/resume.md \
  --keywords-file resume-out/<slug>/keywords.txt --format Letter

# Phase 6 — render only after Gate B
node scripts/md-to-pdf.js resume-out/<slug>/resume.md \
  -o resume-out/<slug>/resume.pdf --format Letter
```

Paths above assume the skill directory as the working directory; use the installed skill path when running from the project root.

## Failure handling

| Situation | Response |
|:--|:--|
| No job description supplied | Ask for the posting text or URL. Do not draft from a job title alone |
| No LinkedIn PDF supplied | Offer to continue from an existing resume, or run the interview cold with extra Round 2 questions |
| Extractor missing | Read the PDF with the agent's file reader, then continue |
| Validator reports errors | Fix the file and re-run. A draft with errors is never presented as finished |
| Estimated fill above 100% | Apply the trimming order in `references/writing-rules.md`, re-validate, then present |
| PDF reports more than one page | Trim, re-render, re-check. Report the page count in the final message |
| No rendering engine installed | The HTML artifact is still written; tell the candidate to open it and print to PDF, and name the engines that would automate it |

## Reporting

Every message that ends a phase states: what was produced, the absolute file path, the validator's error and warning counts, the estimated page fill, keyword coverage, and the single next action expected from the candidate.
