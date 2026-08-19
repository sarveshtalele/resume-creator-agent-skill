<div align="center">

# Resume Creator — Agent Skill

**An agent skill that turns a job posting and your own history into a tailored, ATS-safe, one-page resume.**
Markdown first. PDF only after you approve it.

[![CI](https://github.com/sarveshtalele/resume-creator-agent-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/sarveshtalele/resume-creator-agent-skill/actions/workflows/ci.yml)
[![Quality score](https://img.shields.io/badge/evaluator--skill-96.0%20%2F%20100%20PASS-2e7d74)](docs/EVALUATION.md)
[![Security](https://img.shields.io/badge/SkillSpector-0%20findings-2e7d74)](docs/EVALUATION.md)
[![Runtime dependencies](https://img.shields.io/badge/runtime%20deps-0-5b6c82)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-5b6c82)](package.json)
[![License](https://img.shields.io/badge/license-MIT-5b6c82)](LICENSE)

</div>

<p align="center">
  <img src="docs/assets/pipeline.svg" alt="Six phases: parse, interview, plan, draft, revise, render — with two human approval gates" width="100%">
</p>

---

## Quick start

```bash
npx github:sarveshtalele/resume-creator-agent-skill
```

That copies the skill into `./.claude/skills/resume-architect` for the current project. Install it once for every project instead:

```bash
npx github:sarveshtalele/resume-creator-agent-skill install --global
```

Then start an agent session in that project and say:

> Create a resume based on this job description: *(paste the posting)*
> My LinkedIn export is at ~/Downloads/Profile.pdf

That is the whole setup. No API keys, no config file, no build step, and nothing is fetched at runtime.

<details>
<summary><b>Installing from a local clone</b></summary>

```bash
git clone https://github.com/sarveshtalele/resume-creator-agent-skill.git
cd resume-creator-agent-skill
node bin/cli.js install --dir /path/to/your/project
```

</details>

---

## What happens next

| Phase | What the agent does | What you do |
|:--|:--|:--|
| **1. Parse** | Pulls must-have keywords, seniority signals, and screening constraints from the posting; pulls roles, dates, and education from your LinkedIn export | Nothing |
| **2. Interview** | Asks only what neither source answered — at most 5 questions per round, 3 rounds, each with a proposed default | Answer as a numbered list |
| **3. Plan** | Writes `plan.md`: section order, bullets per role, headline achievement, keyword placement, what is being cut, and any requirement you have no honest evidence for | 🚦 **Gate A** — approve or redirect |
| **4. Draft** | Fills the universal ATS template, then validates structure, one-page fit, and keyword coverage before showing you anything | Read `resume.md` |
| **5. Revise** | Applies your edits — typed in chat or made directly in the file — and re-validates every time | 🚦 **Gate B** — approve when it reads right |
| **6. Render** | Renders the PDF and verifies the real page count | Send the PDF |

Everything lands in one folder per application:

```
resume-out/jane-doe-acme-senior-data-engineer/
├── notes.md          every claim, tagged with its source
├── keywords.txt      keywords extracted from the posting
├── plan.md           the Gate A artifact
├── resume.md         the file you read and edit
├── resume.html       build artifact
└── resume.pdf        final — one page, text-selectable
```

---

## Why use this skill

**It refuses to make things up.** Every number, title, date, and tool traces to your profile export, a document you supplied, or an answer you gave. A requirement you cannot back becomes a flagged gap in the plan, not a sentence on the page.

**It plans before it writes.** You approve the strategy while it is still cheap to change — before there is a draft to fall in love with.

**One page is enforced, not hoped for.** The validator estimates page fill before rendering, and the converter counts pages in the file it produced. Calibrated across 24 length variants: nothing the validator passed ever spilled to two pages. See [docs/EVALUATION.md](docs/EVALUATION.md#page-fit-calibration).

**One template, chosen from how parsers actually behave.** Single column, standard headings, company above title, `Mon YYYY – Mon YYYY` dates, no tables or images. The reasoning and sources are in [the template reference](skills/resume-architect/references/ats-template.md).

**Markdown stays the source of truth.** You can edit the resume in your own editor at any point; the agent re-reads from disk instead of arguing with your version.

**It is cheap to run.** Which is its own section, below.

---

## How it stays cheap

Skills get expensive in three places: what sits in context permanently, what gets pulled in when they trigger, and what gets re-read on every revision. This one is measured on all three — reproduce every number with `npm run measure`.

<p align="center">
  <img src="docs/assets/context-layers.svg" alt="Bar chart: 130 tokens always resident, 2,505 on trigger, about 1,000 per reference file opened on demand, 59 per validator verdict, and 9,218 tokens of script source that is executed but never read" width="100%">
</p>

The bundle is **19,567 tokens**. What is permanently resident is the **130-token description line** — 0.7% of it. Nearly half the bundle is script source that runs as a subprocess and never enters the context window at all: the model reads a 59-token verdict instead of doing layout arithmetic in its head.

<p align="center">
  <img src="docs/assets/disclosure-vs-inline.svg" alt="Column chart comparing 7,383 tokens if all references were inlined into SKILL.md against 2,505 tokens for this skill at trigger time" width="100%">
</p>

The same knowledge written as one long skill file would cost **7,383 tokens** every time it triggered. Split across five reference files that open only when their phase begins, the trigger cost is **2,505** — **66% lighter**, with nothing removed.

<p align="center">
  <img src="docs/assets/revision-loop.svg" alt="Line chart: over five revisions, reading validator verdicts costs 295 tokens cumulatively versus 2,690 tokens for re-reading the resume each time" width="100%">
</p>

Revision is where resume work actually happens, and where a naive skill bleeds. Re-reading the document to check it costs **538 tokens per cycle**; reading the validator's verdict costs **59** — and the verdict already contains the structural findings, page fill, and keyword coverage that a re-read would still have to reason out.

Full methodology, per-file table, and caveats: **[docs/TOKEN_ECONOMY.md](docs/TOKEN_ECONOMY.md)**.

---

## Using it

The complete walkthrough — with a real transcript, what to paste, how to phrase revisions, and how to handle gaps and career changes — is in **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

The three bundled scripts also run standalone, with no agent involved:

```bash
SKILL=.claude/skills/resume-architect

# LinkedIn profile PDF -> clean text
node $SKILL/scripts/extract-linkedin.js Profile.pdf -o profile.txt

# validate structure, one-page fit, and keyword coverage
node $SKILL/scripts/lint-resume.js resume.md --keywords "airflow,dbt,snowflake" --format Letter

# render the approved Markdown
node $SKILL/scripts/md-to-pdf.js resume.md -o resume.pdf --format A4 --json
```

`lint-resume.js` exits 1 on any structural error and prints an estimated page fill before anything is rendered. `md-to-pdf.js` renders through headless Chrome, then wkhtmltopdf, then weasyprint — whichever it finds first — and reports the real page count. With no engine installed it still writes styled HTML you can print to PDF from a browser.

### CLI

```
npx github:sarveshtalele/resume-creator-agent-skill [command] [options]

  install            Copy the skill into a skills directory (default)
  uninstall          Remove a previously installed copy
  list               Show project and global install locations
  where              Print the packaged skill source path

  -g, --global       Install under the home directory, for every project
  -d, --dir <path>   Install into a specific project root or skills directory
  -f, --force        Overwrite an existing installation in place
```

---

## Requirements

| Need | Why | If missing |
|:--|:--|:--|
| Node.js 18+ | Runs the three bundled scripts | Required |
| Chrome, Chromium, or Edge | Renders the PDF | Falls back to wkhtmltopdf, then weasyprint, then styled HTML you print yourself |
| `pdftotext` (poppler) | Extracts the LinkedIn PDF, verifies the PDF reads back correctly | The agent reads the PDF with its own file reader |

---

## Quality

Audited with [evaluator-skill](https://github.com/sarveshtalele/skill-generator-agent-skill/tree/main/skills/evaluator-skill), an 8-dimension quality and security rubric based on the Agent Skills specification and NVIDIA SkillSpector patterns.

| Dimension | Weight | Score |
|:--|:--:|:--:|
| Specification compliance | 10% | 100.0 |
| Content quality | 15% | 100.0 |
| Functional correctness | 25% | 100.0 &nbsp;<sub>37/37 assertions</sub> |
| Skill lift delta | 15% | 78.6 |
| Trigger quality (F1) | 10% | 92.0 |
| Reliability | 5% | 100.0 |
| Efficiency | 5% | 100.0 |
| Security | 15% | 100.0 &nbsp;<sub>0 findings across 68 patterns</sub> |
| **Overall** | | **96.0 / 100 — PASS** |

Skill lift and trigger F1 are fixed constants in the evaluator's standalone mode, so 96.0 is that mode's ceiling. Every dimension the skill controls scores 100. Method and re-run instructions: [docs/EVALUATION.md](docs/EVALUATION.md).

```bash
npm test        # 19 end-to-end checks, real PDFs, real installs
npm run measure # reproduce every token number in this README
npm run diagrams# regenerate the charts from those measurements
```

---

## Documentation

| Document | What is in it |
|:--|:--|
| [User guide](docs/USER_GUIDE.md) | Full walkthrough, worked transcript, revision phrasing, edge cases |
| [Architecture](docs/ARCHITECTURE.md) | Every component, the state machine, data flow, and the design decisions behind them |
| [Token economy](docs/TOKEN_ECONOMY.md) | Measurement method, per-file table, what the charts do and do not claim |
| [Evaluation](docs/EVALUATION.md) | Scorecard, test suite, page-fit calibration data |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Every exit code and failure mode, with the fix |
| [ATS template](skills/resume-architect/references/ats-template.md) | The template itself, the Markdown contract, and the parser research behind it |

---

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm test` before opening one; it needs no network access and takes under a minute.

## License

[MIT](LICENSE) © Sarvesh Talele
