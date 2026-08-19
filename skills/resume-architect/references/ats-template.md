# The Universal ATS Template

One template, every posting. It is a **single-column, reverse-chronological** layout with standard section headings — the shape Workday, Greenhouse, Lever, iCIMS, Taleo, and SuccessFactors all parse without loss. Do not invent a different layout per job; only the wording inside the blocks changes.

## Why this shape

| Choice | Reason |
|:--|:--|
| Single column, no tables, no text boxes | Multi-column layouts get read left-to-right across both columns, interleaving unrelated text |
| Standard headings (`Professional Summary`, `Skills`, `Professional Experience`, `Education`) | Parsers key section detection off a fixed label list; a creative heading drops the whole block |
| Company on its own line, title on the next | Workday's parser assigns the employer from the line above the title |
| `Mon YYYY – Mon YYYY` dates | `Jan 2023 – Mar 2025` parses reliably; `January 2023 to March 2025` frequently does not |
| Hyphen bullets rendered as plain discs | Decorative glyphs are dropped or turned into replacement characters |
| No icons, images, headers, or footers | Non-text content is invisible to parsers, and header/footer text is often skipped entirely |
| Text-based PDF output | Modern parsers read selectable-text PDFs as cleanly as DOCX and the layout stays fixed |
| Calibri/Arial at 10.5pt, name at 19pt | Metric-safe fonts that keep one page without character substitution |

## Markdown contract

The converter in `scripts/md-to-pdf.js` and the validator in `scripts/lint-resume.js` both read this exact dialect. Deviating from it breaks layout, not just style.

```markdown
# Jane Doe
Austin, TX · jane.doe@example.com · (512) 555-0142 · linkedin.com/in/janedoe · janedoe.dev

## Professional Summary
Two to three lines. Target title, years, domain, and the top keywords from the posting.

## Skills
**Languages:** Python, Go, SQL
**Cloud & Data:** AWS, Terraform, Snowflake, Airflow

## Professional Experience

### Acme Analytics — Austin, TX
**Senior Data Engineer** | Mar 2022 – Present
- Rebuilt the ingestion pipeline in Go, cutting nightly load time from 6h to 48m.

## Education

### University of Texas at Austin — Austin, TX
**B.S. in Computer Science** | May 2018
```

Element rules:

1. `# Name` — exactly one level-1 heading, the first content line.
2. Contact line — the single plain line under the name. Separator ` · `. City and state, email, phone, LinkedIn, one portfolio link. No street address.
3. `## Section` — level-2 headings only from the standard list below.
4. `### Organisation — City, ST` — em dash between organisation and location.
5. `**Title** | Mon YYYY – Mon YYYY` — bold title, pipe separator, en dash inside the range, `Present` for current roles.
6. `- bullet` — hyphen marker, one line each, no nesting, no trailing pipe characters.
7. `**Label:** values` — only inside `Skills` and `Certifications`.

Standard section names the validator accepts: Professional Summary, Summary, Skills, Technical Skills, Core Competencies, Professional Experience, Work Experience, Experience, Education, Certifications, Licenses and Certifications, Projects, Selected Projects, Publications, Awards, Volunteer Experience, Additional Information.

## Section order

Fixed for experienced candidates: Summary → Skills → Professional Experience → Education → Certifications → Projects.

Students and career changers with under two years of experience swap two blocks: Summary → Skills → Education → Projects → Professional Experience.

## One-page budget

`Letter` gives 720pt of usable height at 0.5in margins; `A4` gives 769pt. Typical allocation:

| Block | Budget |
|:--|:--|
| Name + contact | ~43pt |
| Summary | 2–3 lines (~42pt) |
| Skills | 3–4 rows (~60pt) |
| Experience | 3–4 roles, 6/4/3/2 bullets newest to oldest |
| Education | 1–2 entries (~35pt) |
| Certifications / Projects | whatever remains |

`scripts/lint-resume.js` estimates fill before rendering. Above 100% it fails; the remedy is cutting the oldest role's bullets first, then compressing the summary, never shrinking the font below 10pt or the margins below 0.4in.

## Blank starting point

`assets/resume-template.md` is the skeleton with placeholder text in the exact dialect. Copy it, then replace every placeholder — never ship a file that still contains one.

## Sources

- Jobscan, [Anatomy of an ATS-Friendly Resume Format](https://www.jobscan.co/blog/20-ats-friendly-resume-templates/)
- Resume.io, [ATS Resume Templates & Format Guide](https://resume.io/resume-templates/ats)
- FastApply, [ATS Resume Format Guide: What Actually Parses](https://blog.fastapply.co/ats-resume-format-guide-2026)
- ApplyArc, [Getting a CV Past Workday's ATS](https://applyarc.com/blog/workday-ats-resume-optimization)
