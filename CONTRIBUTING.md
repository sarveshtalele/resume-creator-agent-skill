# Contributing

Thanks for taking the time. This project is small, dependency-free, and meant to stay that way.

## Getting set up

```bash
git clone https://github.com/sarveshtalele/resume-creator-agent-skill.git
cd resume-creator-agent-skill
npm install     # one dev dependency: gpt-tokenizer, used only to produce the docs
npm test        # 19 end-to-end checks, no network access, about a minute
```

Node 18 or newer. PDF tests skip themselves automatically when no rendering engine is installed, so a machine without Chrome still runs a useful suite.

## Ground rules

**Zero runtime dependencies.** The three scripts in `skills/resume-architect/scripts/` must keep running on a bare Node install. Dev dependencies used to build documentation are fine.

**No network access at runtime.** Nothing in the skill fetches, posts, or phones home. This is checked by the security audit and it is a hard constraint, not a preference.

**Deterministic work belongs in a script; judgement belongs in a reference.** If a rule can be checked exactly, put it in `lint-resume.js` and let the model read the verdict. If it needs taste, write it in `references/` where the model can apply it.

**Every bundled file must be referenced from `SKILL.md`,** and every path `SKILL.md` mentions must exist. Both directions are enforced by the test suite, because a broken pointer means the model looks for something that is not there mid-task.

**`SKILL.md` stays under 500 lines.** Detail moves into `references/`. The point of the split is measured in [docs/TOKEN_ECONOMY.md](docs/TOKEN_ECONOMY.md).

## Making a change

1. Open an issue first for anything that changes the template, the Markdown dialect, or the phase flow. Those ripple through the validator, the renderer, the references, and the tests at once.
2. Add or update a test. New validator rules need both a passing and a failing fixture case.
3. Run the suite: `npm test`.
4. If you touched skill content, refresh the measurements and charts so the documentation cannot drift:
   ```bash
   npm run measure -- --json
   npm run diagrams
   ```
5. If you touched the skill's structure, re-run the external audit described in [docs/EVALUATION.md](docs/EVALUATION.md) and note the score in the pull request.

## Changing the resume template

The template is deliberately conservative — it is shaped by how ATS parsers behave, not by taste. A change to it needs a reason a parser would recognise, ideally with a source. Add the rationale to [`references/ats-template.md`](skills/resume-architect/references/ats-template.md) in the same pull request.

If a change affects rendered height, re-run the page-fit calibration and update the table in [docs/EVALUATION.md](docs/EVALUATION.md#page-fit-calibration).

## Style

Match what is already there: CommonJS, two-space indent, single quotes, no transpiler. Comments explain why, not what. Prose in the references is imperative and direct — skills are followed more reliably as procedure than as suggestion.

## Reporting bugs

Include the command you ran, the full output, your Node version, your platform, and which rendering engine is installed. If it is a layout problem, attach the `resume.md` with your personal details replaced — the structure is what matters.

## License

Contributions are accepted under the [MIT License](LICENSE).
