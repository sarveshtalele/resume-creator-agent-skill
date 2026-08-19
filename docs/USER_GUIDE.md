# User Guide

Everything you need to go from a job posting to a finished PDF, including the parts that usually go wrong.

- [Before you start](#before-you-start)
- [Installing](#installing)
- [Starting a run](#starting-a-run)
- [A complete worked run](#a-complete-worked-run)
- [Answering the interview well](#answering-the-interview-well)
- [Reviewing the plan](#reviewing-the-plan-gate-a)
- [Revising the draft](#revising-the-draft-gate-b)
- [Getting the PDF](#getting-the-pdf)
- [Common situations](#common-situations)
- [Running the scripts yourself](#running-the-scripts-yourself)

---

## Before you start

Have two things ready.

**1. The job posting.** The full text, not the title. Paste it into chat, save it to a file, or give the URL. The posting is where keywords, seniority signals, and screening constraints come from — a title alone produces a generic resume, and the skill will ask for the posting rather than guess.

**2. Your history.** The best source is an exported LinkedIn profile PDF:

> LinkedIn → your profile → **Resources** → **Save to PDF**

An existing resume works too. So does nothing at all — the interview just gets longer, because every fact has to come from you in chat.

---

## Installing

Per project, from the project root:

```bash
npx github:sarveshtalele/resume-creator-agent-skill
```

Once for every project:

```bash
npx github:sarveshtalele/resume-creator-agent-skill install --global
```

Check what is installed where:

```bash
npx github:sarveshtalele/resume-creator-agent-skill list
```

Skills are read when a session starts, so open a new agent session after installing.

---

## Starting a run

Say what you want, attach what you have:

> Create a resume based on this job description:
> *(paste the full posting)*
>
> My LinkedIn export is at ~/Downloads/Profile.pdf

Other phrasings that start the same run: "tailor my resume for this role", "make my resume ATS friendly", "build a CV from my LinkedIn export", "convert my resume Markdown to PDF".

---

## A complete worked run

```
You:   Create a resume based on this job description: [Senior Data Engineer, Acme
       Analytics — Python, Airflow, dbt, Snowflake, streaming, 5+ years].
       My LinkedIn export is at ~/Downloads/Profile.pdf

Agent: Parsed the posting: 11 must-have keywords, top five are Python, Airflow, dbt,
       Snowflake, streaming. Screening constraint: 5+ years, Austin or remote-US.
       Extracted 4 roles and 1 degree from your profile.

       Five questions, defaults in brackets:
       1. Exact title and company for this application? [Senior Data Engineer, Acme Analytics]
       2. Contact block — name, city/state, email, phone, LinkedIn, portfolio?
       3. Your strongest result from the last 3 years, with a number?
       4. The posting asks for Kafka twice. Your profile shows Kafka Connect only —
          have you run Kafka in production?
       5. Letter or A4? [Letter]

You:   1 yes. 2 Jane Doe, Austin TX, jane.doe@example.com, (512) 555-0142,
       linkedin.com/in/janedoe, janedoe.dev. 3 Rebuilt the nightly pipeline, 6h to
       48m, 40M records. 4 No — only Kafka Connect as a consumer. 5 Letter.

Agent: plan.md written.
       Order: Summary → Skills → Experience → Education → Certifications.
       Bullets: Acme 5, Globex 4, Initech 3. Headline: the 6h→48m rebuild.
       Keywords placed: Python/Airflow/dbt/Snowflake in Acme and Globex bullets;
       streaming in the summary.
       Not claiming: Kafka. You have Kafka Connect only — I will say that precisely
       in the Skills row and flag Kafka for your cover letter.
       Cut to hold one page: the 2015 internship, and the third Initech bullet.
       Approve this plan?

You:   approved

Agent: resume-out/jane-doe-acme-senior-data-engineer/resume.md
       Validator: 0 errors, 0 warnings. 93% of one Letter page.
       Keyword coverage: 91% (missing: Kafka — deliberate).
       Read it and tell me what to change.

You:   Swap the third Acme bullet for the warehouse cost work, and make the summary
       two sentences.

Agent: Done. 0 errors, 0 warnings, 90% page fill, coverage unchanged.
       Approve to render the PDF?

You:   approve

Agent: resume-out/jane-doe-acme-senior-data-engineer/resume.pdf
       Rendered with Chrome — 1 page, 58 KB, text verified readable.
```

---

## Answering the interview well

**Answer as a numbered list.** Questions arrive numbered so replies can be short: `1 yes. 2 Jane Doe... 3 ...`

**Give ranges when you do not have exact figures.** "Somewhere between 30 and 40 percent" is usable — the conservative end gets written. "I improved it a lot" is not.

**Say no plainly.** If you have not used a tool, say so. That answer is not a failure; it changes the plan, and the gap gets flagged for your cover letter instead of becoming a claim you have to defend in an interview.

**Say what to leave off.** An employer, a gap, a date, a title — name it in Round 1 and it never reaches the page.

The full question bank is in [`intake-questions.md`](../skills/resume-architect/references/intake-questions.md).

---

## Reviewing the plan (Gate A)

The plan is prose about strategy, not a draft. Read it for five things:

1. **Section order** — does it lead with what this employer buys?
2. **Bullet budget per role** — the newest role should dominate.
3. **The headline achievement** — is it the one you would open an interview with?
4. **Keyword placement** — is each keyword going somewhere it is actually true?
5. **The cut list and the gap list** — do you agree with what is being dropped and what is not being claimed?

Redirect in plain language: "lead with the Globex migration instead", "give Initech only two bullets", "drop the certifications section". The plan is rewritten and re-presented. Nothing is drafted until you say approve.

---

## Revising the draft (Gate B)

You have two ways to change the draft, and you can mix them freely.

**Edit the file yourself.** Open `resume-out/<slug>/resume.md` in any editor, change what you like, save, and say "I edited the file". The agent re-reads from disk — your version wins — then re-validates.

**Describe the change.** "Cut the last Initech bullet." "Make bullet two lead with the outcome." "Move Certifications above Education." "Tighten the summary to two sentences."

After every change you get the same four numbers: errors, warnings, page fill, keyword coverage. Warnings are judgement calls, not failures — `W-SPARSE` at 74% fill means the page will look thin, and that may be exactly right for a two-role career.

When it reads the way you want it: **approve**, **approved**, or **looks good, make the PDF**. Anything vaguer gets one direct question, because rendering a PDF you did not actually approve wastes your time twice.

### What the validator checks

Structure the parsers care about — one name heading, a contact line with an email, standard section names, company above title, `Mon YYYY – Mon YYYY` dates, hyphen bullets, no tables or images or emoji, no first-person pronouns — plus writing quality signals: weak opening verbs, bullets over 230 characters, roles with more than six bullets, and the share of bullets carrying a number. Every code is listed in [Troubleshooting](TROUBLESHOOTING.md#validator-codes).

---

## Getting the PDF

After Gate B the PDF is rendered and its page count is read back from the file itself. You get the absolute path, the engine used, and the confirmed count.

If it comes back as two pages, the fix order is fixed and the agent applies it: cut the oldest role's last bullet, shorten bullets that wrap with only a few words on the second line, reduce the summary to two sentences, merge two Skills rows. Font size and margins are the last resort and never go below 10pt or 0.4in.

To check what an ATS will see:

```bash
pdftotext -layout resume-out/<slug>/resume.pdf - | head -40
```

The name should be the first line, each company should appear above its title, and every date range should be present.

---

## Common situations

**"I don't have a LinkedIn export."** Give an existing resume instead, or run the interview cold. Expect more Round 2 questions about metrics.

**"My PDF won't extract."** The extractor exits with code 4 when neither `pdftotext` nor `mutool` is installed. The agent falls back to reading the PDF directly. Nothing stalls.

**"I'm changing careers."** Say so in Round 1. The plan reorders around transferable work and the summary reframes the target, but nothing gets invented — a career change is a framing problem, not a fabrication problem.

**"I have a two-year gap."** Round 3 asks how you want it handled. The options are a plain date gap, a one-line explanation, or year-only dates for the surrounding roles. Dates never disappear.

**"I need this for a second job."** Start a new run. Each application gets its own folder; the previous one is never overwritten.

**"Can I get a two-page resume?"** Not from this skill. It enforces one page end to end. For most roles below director level, one page is the stronger document anyway.

---

## Running the scripts yourself

The three scripts are plain Node with no dependencies and no network access. They are useful outside an agent session — for example, in a pre-commit hook over a resume you maintain by hand.

```bash
SKILL=.claude/skills/resume-architect

node $SKILL/scripts/extract-linkedin.js Profile.pdf -o profile.txt --json
node $SKILL/scripts/lint-resume.js resume.md --keywords-file keywords.txt --json
node $SKILL/scripts/md-to-pdf.js resume.md -o resume.pdf --format Letter --json
```

Exit codes: `0` success, `1` validation errors, `2` bad input, `3` no rendering engine, `4` render or extraction failed. Every flag is documented in [Architecture](ARCHITECTURE.md#the-scripts).
