---
name: resume-architect
description: >
  Builds a tailored, ATS-safe, one-page resume for a specific job posting. Runs a short structured
  interview, reads the job description and an exported LinkedIn profile PDF for context, writes a
  plan for approval, produces an editable Markdown resume in a universal single-column template,
  revises it until the candidate approves, then renders a text-based one-page PDF.
  Use this whenever the user says create a resume, tailor my resume to this job description, write
  a CV for this posting, make my resume ATS friendly, update my resume from my LinkedIn PDF, or
  convert my resume Markdown to PDF.
compatibility: "Node.js 18+"
allowed-tools: "Read, Write, Edit, Glob, Grep, AskUserQuestion, Bash(node:*), Bash(pdftotext:*)"
metadata:
  sdlc: Authoring
  tags:
    - resume
    - ats
    - job-search
    - pdf-generation
---

# Resume Architect

Turns a job posting plus a candidate's own history into a single-page, parser-safe resume. The
deliverable is a Markdown file the candidate can read and edit, and a PDF rendered from it after
explicit approval. One universal template is used for every posting — see
[`references/ats-template.md`](references/ats-template.md) — because the layout is what parsers
read, and only the wording should change per job.

## When to use

Trigger on: "create a resume based on this job description", "tailor my resume for this role",
"make my resume ATS friendly", "build a CV from my LinkedIn export", "convert my resume to PDF".

Do not trigger for: cover letters, LinkedIn profile rewrites, interview preparation, or salary
negotiation. Those are separate jobs with separate shapes.

## Two hard gates

The run stops twice and waits for a human:

- **Gate A** — the plan is approved before any resume text is written.
- **Gate B** — the Markdown is approved before any PDF is rendered.

Approval means an explicit affirmative such as "approve", "approved", "looks good, make the PDF".
Anything ambiguous is not approval; ask once, directly. The full state machine, the working
directory layout, and the failure table live in
[`references/workflow-contract.md`](references/workflow-contract.md).

## Workflow

### Phase 0 — Intake setup

Confirm two inputs exist: the **job description text** (pasted, in a file, or at a URL) and a
**profile source** (an exported LinkedIn PDF, an existing resume, or the interview alone). Ask for
whichever is missing. Create the run folder `resume-out/<first-last>-<company>-<role>/`.

### Phase 1 — Parse both sources

Extract from the posting: target title, up to 12 must-have keywords, up to 8 nice-to-haves, the
posting's own responsibility verbs, and screening constraints. Write one keyword per line to
`keywords.txt`.

Extract the profile. With a local extractor installed:

```bash
SKILL=.claude/skills/resume-architect   # or the home-directory copy when installed globally
node $SKILL/scripts/extract-linkedin.js <profile.pdf> -o resume-out/<slug>/profile.txt
```

Exit code 4 means no extractor is installed — read the PDF with the agent's own file reader and
carry on. Either way, write `notes.md`: every role, title, date range, and claim, each tagged with
where it came from. Guidance on what to pull from each source is in
[`references/intake-questions.md`](references/intake-questions.md).

### Phase 2 — Interview

Ask only what the two sources cannot answer. Batch questions, at most 5 per round and 3 rounds
total, numbered so they can be answered as a list. Round 1 is always asked: target and level,
contact block, headline achievement, coverage gaps against must-have requirements, and constraints
such as page format. Round 2 recovers missing metrics. Round 3 handles gaps and framing. Offer a
proposed default with each question so silence still moves the work forward.

### Phase 3 — Plan (Gate A)

Write `plan.md` and show it in chat. It states, in prose:

1. Section order and which template variant applies (experienced, or student and career changer).
2. Each role, with the bullet count it gets — typically 6 / 4 / 3 / 2 from newest to oldest.
3. The headline achievement chosen for the summary.
4. Where each must-have keyword will land, and which keywords have no honest evidence.
5. What is being cut to hold one page.

Then ask for approval. Edits return here; they do not advance. **Write no resume text before
approval.**

### Phase 4 — Draft

Copy [`assets/resume-template.md`](assets/resume-template.md) to `resume.md` and fill it, following
the bullet formula, verb list, keyword-placement rules, and truthfulness gate in
[`references/writing-rules.md`](references/writing-rules.md). Every claim traces to `notes.md` or an
interview answer. Then validate:

```bash
node $SKILL/scripts/lint-resume.js resume-out/<slug>/resume.md \
  --keywords-file resume-out/<slug>/keywords.txt --format Letter
```

Fix every error and re-run until it exits 0. Warnings are judgement calls: fix them or explain why
they stand. Only then show the candidate the file path, the error and warning counts, the estimated
page fill, and the keyword coverage.

### Phase 5 — Revision (Gate B)

Invite edits and support both channels: the candidate edits `resume.md` in an editor, or describes
changes in chat. When they say they edited the file, re-read it from disk first — their version is
the newer truth. Re-run the validator after every change and report the new page fill. Loop until
they approve.

### Phase 6 — Render

Only after Gate B:

```bash
node $SKILL/scripts/md-to-pdf.js resume-out/<slug>/resume.md \
  -o resume-out/<slug>/resume.pdf --format Letter --json
```

Read `pages` from the JSON result. If it is above 1, trim using the order in
[`references/writing-rules.md`](references/writing-rules.md), re-render, and check again. Report the
absolute PDF path, the engine used, and the confirmed page count. Engine detection, exit codes, and
the two-page remedy sequence are documented in
[`references/pdf-pipeline.md`](references/pdf-pipeline.md); the print stylesheet that fixes the page
box, margins, and type scale is [`assets/resume.css`](assets/resume.css).

## Non-negotiables

1. **No invented facts.** Every number, title, date, and tool traces to the profile, a supplied
   document, or an interview answer. An unverified claim is raised as a gap instead of written.
2. **One page.** The validator estimates fill before rendering; the converter counts pages after.
   Both are checked, and the count is reported.
3. **One template.** Single column, standard headings, `Mon YYYY – Mon YYYY` dates, hyphen bullets,
   no tables, no images, no icons, no headers or footers.
4. **Markdown is the source.** The PDF is a build artifact, regenerated from the Markdown, never
   hand-edited.
5. **Gates are human.** Neither approval is inferred from enthusiasm about a draft.

## Command reference

Set `SKILL` once per session to wherever this skill is installed — the project copy at
`.claude/skills/resume-architect`, or the equivalent path under the home directory when it was
installed globally. Then:

```bash
# profile text from an exported LinkedIn PDF
node $SKILL/scripts/extract-linkedin.js <profile.pdf> -o <out.txt> --json

# validate structure, one-page fit, and keyword coverage
node $SKILL/scripts/lint-resume.js <resume.md> --keywords "kubernetes,terraform" --format Letter --json

# render the approved Markdown to PDF
node $SKILL/scripts/md-to-pdf.js <resume.md> -o <resume.pdf> --format A4 --json
```

All three are dependency-free Node scripts with no network access:
[`scripts/extract-linkedin.js`](scripts/extract-linkedin.js),
[`scripts/lint-resume.js`](scripts/lint-resume.js), and
[`scripts/md-to-pdf.js`](scripts/md-to-pdf.js). Exit codes: `0` success, `1` validation errors,
`2` bad input, `3` no rendering engine, `4` render or extraction failed.

## Example

```
User: Create a resume based on this job description: [Senior Data Engineer posting].
      My LinkedIn export is at ~/Downloads/Profile.pdf

Agent: [Phase 1] Parsed the posting — 11 must-have keywords, top 5: Python, Airflow, dbt,
       Snowflake, streaming. Extracted 4 roles and 1 degree from the profile.
       [Phase 2] Five questions, numbered, with proposed defaults.

User: [answers]

Agent: [Phase 3] plan.md written. Summary → Skills → Experience (Acme 6 bullets, Globex 4,
       Initech 3, Umbrella 2) → Education → Certifications. Headline: the 6h-to-48m pipeline
       rebuild. No evidence for Kafka — leaving it off and flagging it for the cover letter.
       Approve this plan?

User: approved

Agent: [Phase 4] resume-out/jane-doe-acme-senior-data-engineer/resume.md
       Validator: 0 errors, 1 warning (W-SPARSE, 88% page fill). Keyword coverage 91%.
       Read the file and tell me what to change.

User: Swap bullet 3 at Acme for the cost work, then approve.

Agent: [Phase 5] Done — 0 errors, 90% fill. Approved?

User: approve

Agent: [Phase 6] resume-out/jane-doe-acme-senior-data-engineer/resume.pdf
       Rendered with Chrome, 1 page, 41 KB. Text verified readable with pdftotext.
```

## Bundled resources

- [`references/ats-template.md`](references/ats-template.md) — the universal template, the Markdown
  dialect contract, section order, and the one-page budget.
- [`references/intake-questions.md`](references/intake-questions.md) — the question bank and what to
  extract from the posting and the profile.
- [`references/writing-rules.md`](references/writing-rules.md) — bullet formula, verb lists, keyword
  integration, truthfulness gate, trimming order.
- [`references/workflow-contract.md`](references/workflow-contract.md) — phase state machine, gate
  definitions, folder layout, failure handling.
- [`references/pdf-pipeline.md`](references/pdf-pipeline.md) — render stages, engine detection, exit
  codes, two-page remedies, ATS read-back check.
- [`assets/resume-template.md`](assets/resume-template.md) — blank skeleton in the exact dialect.
- [`assets/resume.css`](assets/resume.css) — print stylesheet for the one-page layout.
- [`scripts/extract-linkedin.js`](scripts/extract-linkedin.js) — LinkedIn PDF to clean text.
- [`scripts/lint-resume.js`](scripts/lint-resume.js) — ATS and one-page validator.
- [`scripts/md-to-pdf.js`](scripts/md-to-pdf.js) — Markdown to single-page PDF converter.
