# Evaluation

Three independent checks stand behind this skill: an external quality and security audit, a local end-to-end test suite, and an empirical calibration of the one-page model against real renderer output.

- [Quality audit](#quality-audit)
- [Security](#security)
- [End-to-end test suite](#end-to-end-test-suite)
- [Page-fit calibration](#page-fit-calibration)
- [Reproducing all of it](#reproducing-all-of-it)

---

## Quality audit

Audited with [evaluator-skill](https://github.com/sarveshtalele/skill-generator-agent-skill/tree/main/skills/evaluator-skill), which scores a skill on eight weighted dimensions drawn from the Agent Skills specification and the NVIDIA SkillSpector pattern taxonomy.

| # | Dimension | Weight | Score | Notes |
|:--|:--|:--:|:--:|:--|
| 1 | Specification compliance | 10% | **100.0** | Valid frontmatter, name matches folder, no broken references |
| 2 | Content quality | 15% | **100.0** | 220-line `SKILL.md`, worked examples, progressive disclosure present |
| 3 | Functional correctness | 25% | **100.0** | 37 / 37 assertions across 8 eval cases |
| 4 | Skill lift delta | 15% | 78.6 | Fixed constant in standalone mode |
| 5 | Trigger quality (F1) | 10% | 92.0 | Fixed constant in standalone mode |
| 6 | Reliability | 5% | **100.0** | No execution failures, no timeouts |
| 7 | Efficiency | 5% | **100.0** | Token footprint and wall-clock inside budget |
| 8 | Security | 15% | **100.0** | 0 findings across 68 patterns |
| | **Overall** | | **96.0 / 100** | Gate: **PASS** |

Dimensions 4 and 5 are hardcoded in the evaluator's standalone runner (a 0.35 lift constant and an F1 of 0.92), so **96.0 is the ceiling that mode can award**. Every dimension the skill actually controls scores 100, and the structural checker reports 100/100 with zero issues at any severity.

### Running it yourself

```bash
git clone https://github.com/sarveshtalele/skill-generator-agent-skill.git
cd skill-generator-agent-skill

python3 skills/evaluator-skill/scripts/run_evaluation.py \
  --skill /path/to/resume-creator-agent-skill/skills/resume-architect \
  --output ./scorecards --with-baseline
```

Scorecards land in `scorecards/resume-architect.md` and `.json`.

---

## Security

```
python3 skills/evaluator-skill/scripts/security_scan.py \
  /path/to/skills/resume-architect
```

```
Risk score: 0/100  (LOW, SAFE)
Components: 13  Findings: 0
```

Zero findings across prompt injection, data exfiltration, privilege escalation, supply chain, excessive agency, tool misuse, rogue-agent persistence, MCP least-privilege, tool poisoning, agent snooping, output handling, and anti-refusal patterns, plus the Unicode homoglyph and YARA signature passes.

That result follows from the skill's shape, not from suppressions — there are none:

- No network access at runtime. Nothing is fetched, posted, or phoned home.
- No shell strings. Subprocesses are spawned with literal argument arrays; no `shell: true` anywhere.
- Writes are confined to the `resume-out/` folder the run creates, plus a temporary browser profile directory that is removed afterwards.
- No credential, environment, or filesystem enumeration.
- No self-modification and no persistence mechanisms.

---

## End-to-end test suite

```bash
npm test
```

19 checks, no network access, about a minute on a laptop. The suite renders real PDFs and performs a real install rather than mocking either.

**Bundle integrity**
- every file `SKILL.md` references exists in the bundle
- every bundled file is referenced from `SKILL.md`
- frontmatter is valid, the name matches the folder, and the body is under 500 lines
- `evals.json` parses and each `file:` assertion resolves

**Validator**
- accepts the reference resume and reports it fits one page
- catches every seeded defect in the broken fixture: `E-EMAIL`, `E-SECTION`, `E-DATEFMT`, `E-PRONOUN`, `E-GLYPH`, `E-TABLE`
- scores keyword coverage exactly, including the missing terms
- the blank skeleton uses only standard section headings

**Renderer**
- the Markdown dialect produces the expected HTML structure, and emits no tables or images
- `--html-only` writes a self-contained page with the page box and stylesheet inlined

**PDF pipeline** *(skipped automatically when no engine is installed)*
- Letter renders to exactly one page
- A4 renders to exactly one page
- content the validator rejects as overflowing does render as more than one page
- content the validator accepts near the limit does render on one page
- the rendered PDF is text-selectable, in document order, with each company above its title
- the extractor round-trips a rendered PDF back to text

**Packaging**
- the installer copies the full bundle, refuses to clobber without `--force`, and uninstalls cleanly
- the installed copy runs from its new location
- the CLI's `--help` and `list` commands work

---

## Page-fit calibration

The validator predicts page fill before rendering. To find out whether the prediction is trustworthy, 24 variants of the reference resume were generated with increasing content, then each was both validated and rendered with Chrome.

| Estimated fill | Actual pages |
|:--|:--|
| 84%, 86%, 88%, 89%, 91%, 92%, 93%, 95%, 96%, 97%, 98%, 99% | 1 |
| 100%, 101%, 102% | 1 |
| 104%, 105%, 107%, 108% | 2 |

**Findings**

- Every document estimated at or below 100% rendered on one page. No false passes.
- Documents still fit at estimates up to 102%, so the model runs 2–4 points pessimistic.
- The first two-page result appeared at an estimate of 104%.

The threshold stays at 100% despite the slack, because font substitution on a machine without Calibri consumes exactly that margin. Erring toward one extra trimmed bullet is the right trade against a resume that silently becomes two pages on someone else's computer.

Regenerate the data with `tools/` — the calibration harness is a dozen lines around the two scripts, and the two boundary cases are permanent tests in `npm test`.

---

## Reproducing all of it

```bash
npm install          # dev dependency: gpt-tokenizer, for the docs numbers only
npm test             # 19 end-to-end checks
npm run measure      # every token figure quoted in the documentation
npm run diagrams     # regenerate the charts from those measurements
npm run lint:demo    # validator against the reference resume
npm run pdf:demo     # render the reference resume to .tmp/demo.pdf
```
