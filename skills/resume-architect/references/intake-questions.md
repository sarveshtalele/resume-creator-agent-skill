# Intake Question Bank

The interview is short on purpose. Read the job description and the LinkedIn export first, then ask only about what those two sources cannot answer. Every question you ask that the profile already answers costs the candidate patience.

## Rules of the interview

1. **Batch.** Maximum 5 questions per round, maximum 3 rounds. Number them so answers can be given as a list.
2. **Gap-driven.** Before each round, write down what is still unknown; ask only that.
3. **Offer a default.** Give a proposed answer where one is reasonable: "I plan to lead with the Stripe migration — object if a different project should headline."
4. **Never invent.** An unanswered question means the claim does not go on the resume.
5. **Stop early.** If Round 1 answers everything, skip to the plan.

## Round 1 — always asked (the blocking five)

1. **Target and level.** Exact job title and company applying to; is the posting a match for current level, a stretch, or a step down?
2. **Contact block.** Name as it should appear, city and state, email, phone, LinkedIn handle, one portfolio or GitHub link.
3. **Headline achievement.** The one result from the last three years that best matches the posting, with a number attached.
4. **Coverage check.** Which must-have requirements in the posting have no real evidence in the profile? Only real experience gets written.
5. **Constraints.** Page format (Letter or A4), work authorisation or relocation line needed, anything to leave off (an employer, a gap, a date).

## Round 2 — metric recovery

Ask only for roles whose bullets would otherwise carry no number.

- Scale: team size, users served, requests per second, records processed, budget owned, accounts managed.
- Delta: what the number was before and after, over what period.
- Speed: how long the work took, or how much time it saved per cycle.
- Money: revenue influenced, cost removed, churn avoided — a percentage is fine when absolutes are confidential.
- Quality: defect rate, uptime, NPS, audit findings closed.

When an exact figure is unknown, ask for a defensible range and write the conservative end.

## Round 3 — gaps and framing

- Employment gaps over three months: what to say, if anything.
- Title inflation or deflation: the title on record versus the work actually done.
- Career change: which prior work is genuinely transferable.
- Publications, patents, speaking, open source: only if the posting rewards them.
- Anything the candidate wants kept off the page.

## Reading the job description

Extract and keep in the working notes:

- **Target title** and seniority signals.
- **Must-have keywords** — hard skills, tools, certifications, domain nouns. Cap at 12.
- **Nice-to-have keywords** — cap at 8.
- **Responsibility verbs** — the verbs the posting itself uses (own, scale, migrate, mentor).
- **Domain vocabulary** — the industry words that should echo in the summary.
- **Screening constraints** — degree, clearance, licence, years of experience, location.

Store these as the keyword list passed to `scripts/lint-resume.js --keywords` so coverage is measured, not guessed.

## Reading the LinkedIn export

The exported profile PDF is a fact source, not a draft. Pull:

- Legal name, headline, location, public profile URL.
- Every role: company, title, dates, location, description text.
- Education, certifications, licences, languages, honours, publications.
- Listed skills and endorsements (useful for keyword matching, weak as evidence).

Text quality varies by export. `scripts/extract-linkedin.js` handles the common two-column export layout; when no extractor is installed on the machine, read the PDF directly with the agent's own file reader and continue.

## Question phrasing that works

- "The posting asks for Kubernetes twice. Your profile shows Docker and ECS — have you run Kubernetes in production, and where?"
- "Your Acme bullet says you improved reporting. Improved from what to what, and over how long?"
- "You have four roles since 2016. I plan to give the newest six bullets and the oldest two — say if the 2018 role deserves more weight."
