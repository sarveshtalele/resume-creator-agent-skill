# Troubleshooting

Every failure mode this skill has, and what to do about it.

- [Installation](#installation)
- [Exit codes](#exit-codes)
- [Validator codes](#validator-codes)
- [PDF rendering](#pdf-rendering)
- [LinkedIn extraction](#linkedin-extraction)
- [Layout and page count](#layout-and-page-count)
- [Agent behaviour](#agent-behaviour)

---

## Installation

**The agent does not seem to know about the skill.**
Skills are read at session start. Open a new session after installing. Confirm the files are where you think they are:

```bash
npx github:sarveshtalele/resume-creator-agent-skill list
```

**`Already installed at ...`**
An installation exists at that path. Replace it with this version:

```bash
npx github:sarveshtalele/resume-creator-agent-skill install --force
```

**Installed globally but a project ignores it.**
A project-level copy takes precedence over the global one. Check `list` for both, and uninstall whichever you did not intend to keep.

---

## Exit codes

| Code | Script | Meaning | Fix |
|:--:|:--|:--|:--|
| 0 | all | Success | — |
| 1 | `lint-resume.js` | Structural errors found | Fix the codes it printed, re-run |
| 2 | all | Bad input: missing file, unknown format | Check the path and the `--format` value |
| 3 | `md-to-pdf.js` | No rendering engine found | Install Chrome, wkhtmltopdf, or weasyprint — or open the HTML it still wrote and print to PDF |
| 4 | `md-to-pdf.js` | Engine ran but produced nothing usable | Re-run with `--engine chrome`; check the message it printed |
| 4 | `extract-linkedin.js` | No PDF text extractor installed | Install poppler for `pdftotext`, or let the agent read the PDF directly |

---

## Validator codes

### Errors — these block

| Code | Meaning |
|:--|:--|
| `E-NAME` | No `# Full Name` heading on the first content line |
| `E-H1` | More than one level-1 heading; the name must be the only one |
| `E-CONTACT` | No contact line directly under the name |
| `E-EMAIL` | The contact line has no email address |
| `E-SECTION` | A required section is missing: Summary, Skills, or Experience |
| `E-ROLE` | An entry has no `**Title** \| Mon YYYY – Mon YYYY` line beneath it |
| `E-DATEFIELD` | The role line has no `\|` separator before the date range |
| `E-DATEFMT` | Dates are not `Mon YYYY – Mon YYYY`, `Mon YYYY – Present`, or a single `Mon YYYY` |
| `E-BULLETS` | No bullet points anywhere in the document |
| `E-PRONOUN` | A bullet starts with a personal pronoun |
| `E-GLYPH` | A bullet contains a decorative glyph that parsers drop |
| `E-EMOJI`, `E-EMOJI-DOC` | An emoji in a bullet, or anywhere in the document |
| `E-TABLE` | A Markdown table — these scramble in ATS parsers |
| `E-IMAGE` | An image, which a parser cannot read |
| `E-OVERFLOW` | Estimated above 100% of one page |

### Warnings — judgement calls

| Code | Meaning | When to ignore it |
|:--|:--|:--|
| `W-PHONE` | No phone number in the contact line | Deliberately omitting it |
| `W-CONTACT-LEN` | The contact line may wrap to a second line | Rarely |
| `W-EDU` | No Education section | Education genuinely irrelevant to the target |
| `W-HEADING` | A non-standard section heading | Almost never — parsers key off the label |
| `W-ORG` | An entry is not shaped `Organisation — City, ST` | Remote roles with no meaningful location |
| `W-MARKER` | A bullet uses `*` instead of `-` | Cosmetic only |
| `W-LONG` | A bullet is over 230 characters | Rarely; long bullets get skimmed |
| `W-VERB` | A bullet opens with a weak verb | When the weak verb is genuinely accurate |
| `W-METRICS` | Fewer than half the bullets carry a number | Roles where numbers are confidential |
| `W-DENSITY` | A role has more than six bullets | The current role at a senior level |
| `W-TIGHT` | Above 96% page fill | When you control the machine that renders it |
| `W-SPARSE` | Below 70% page fill | Early-career resumes with little history |
| `W-KEYWORDS` | Keyword coverage under 70% | When the missing terms are ones you honestly lack |
| `W-HTML` | Raw HTML in the file | Never — remove it |

---

## PDF rendering

**`error: no PDF rendering engine found`**
The HTML is still written next to where the PDF would have gone. Open it in a browser and print to PDF — the page box, margins, and type scale are already set, so the result matches. To automate it, install any one of Chrome, Chromium, Edge, wkhtmltopdf, or weasyprint.

**The renderer hangs or times out.**
Headless Chrome writes the file quickly and then lingers. The runner handles this by polling for the output and stopping the process, bounded by `--timeout` (default 60s). Raise it on a slow machine:

```bash
node $SKILL/scripts/md-to-pdf.js resume.md -o resume.pdf --timeout 120000
```

**Chrome is installed somewhere unusual.**

```bash
RESUME_CHROME="/path/to/chrome" node $SKILL/scripts/md-to-pdf.js resume.md -o resume.pdf
```

**Dates are not right-aligned.**
That is wkhtmltopdf, which does not implement flexbox the way Chrome does. The text order is unchanged, so parsing is unaffected. Force a better engine with `--engine chrome`.

**`pdftotext` returns nothing from the PDF.**
The PDF is image-based, which means an unexpected engine ran. Re-render with `--engine chrome`. Never fix this downstream — an image PDF scores zero in every ATS.

---

## LinkedIn extraction

**Exit code 4.**
Neither `pdftotext` nor `mutool` is installed. Either install poppler, or let the agent read the PDF with its own file reader — the run continues normally.

**The extracted text is jumbled.**
LinkedIn's export is two-column in places. The cleaner handles the common layout, but a heavily customised profile can still interleave. Skim `profile.txt`; anything wrong there gets corrected during the interview, and the fact base is what the resume is built from.

**Skills are missing from the extract.**
LinkedIn truncates the skills list in the PDF export. Mention the missing ones in the interview.

---

## Layout and page count

**The PDF is two pages.**
Apply the fixes in order, re-rendering after each: cut the oldest role's last bullet; shorten bullets that wrap with only a few words on the second line; reduce the summary to two sentences; merge two Skills rows. Font size and margins are last, and never go below 10pt or 0.4in.

**The validator says 88% but the page looks empty.**
Estimated fill counts text height, not visual weight. A resume with two roles will look thin at 88%. Add substance — a Projects section or a Certifications row — rather than padding existing bullets.

**The validator says it fits, the PDF says two pages.**
Possible when the rendering machine lacks Calibri and substitutes a wider face. Re-render on a machine with the font, or trim one bullet. Calibration data for the estimator is in [EVALUATION.md](EVALUATION.md#page-fit-calibration).

---

## Agent behaviour

**It skipped the interview.**
The interview is gap-driven. If the posting and the profile answered everything, Round 1 is short or absent by design. Volunteer anything that matters.

**It will not write a keyword I asked for.**
By design. The truthfulness gate blocks claims with no traceable source. Give it a real example of that work and it goes in; otherwise it stays flagged for your cover letter.

**It rendered a PDF before I approved.**
It should not. Gate B requires an explicit affirmative. If it happens, the Markdown is still the source of truth — edit it and re-render, and please open an issue.

**It asked whether I approved when I thought I had.**
Ambiguous approval — "nice", "ok I think", "sure, but…" — is treated as not approved on purpose. Say "approve" and it moves.
