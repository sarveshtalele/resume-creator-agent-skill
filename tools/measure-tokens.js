#!/usr/bin/env node
/**
 * measure-tokens.js — reproduce every token number quoted in the docs.
 *
 *   npm run measure
 *
 * Uses the gpt-tokenizer dev dependency (o200k BPE) when installed. Claude's
 * tokenizer differs by a few percent; the ratios between layers are what the
 * documentation claims, and those hold across BPE vocabularies.
 *
 * Falls back to a characters-over-four estimate when the tokenizer is absent,
 * and says so in the output rather than passing estimates off as measurements.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILL = path.join(ROOT, 'skills', 'resume-architect');

let encode;
let method;
try {
  encode = require('gpt-tokenizer/model/gpt-4o').encode;
  method = 'o200k BPE (gpt-tokenizer)';
} catch (_) {
  encode = (s) => ({ length: Math.round(s.length / 4) });
  method = 'ESTIMATE: characters / 4 — install the dev dependencies for real counts';
}

const count = (text) => encode(text).length;
const countFile = (f) => count(fs.readFileSync(f, 'utf8'));

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else out.push({ file: rel, tokens: countFile(full), bytes: fs.statSync(full).size });
  }
  return out;
}

function sum(rows) {
  return rows.reduce((n, r) => n + r.tokens, 0);
}

/**
 * Run a bundled script and count its output. Paths stay relative and the child
 * runs from the repository root, so the measurement is identical on every
 * machine — an absolute path in the output would tokenize differently per host
 * and make the published numbers unreproducible.
 */
function scriptOutput(args) {
  const res = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: ROOT });
  return count((res.stdout || '') + (res.stderr || ''));
}

function main() {
  const files = walk(SKILL).sort((a, b) => b.tokens - a.tokens);
  const skillMd = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
  const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/)[1];
  const description = frontmatter.match(/description: >\n([\s\S]*?)\ncompatibility:/)[1];

  const references = files.filter((f) => f.file.startsWith('references/'));
  const scripts = files.filter((f) => f.file.startsWith('scripts/'));

  const sample = 'test/fixtures/sample-resume.md';
  const bad = 'test/fixtures/bad-resume.md';
  const lint = 'skills/resume-architect/scripts/lint-resume.js';

  const layers = {
    metadata_description_always_resident: count(description),
    skill_md_on_trigger: countFile(path.join(SKILL, 'SKILL.md')),
    one_reference_min: Math.min(...references.map((r) => r.tokens)),
    one_reference_max: Math.max(...references.map((r) => r.tokens)),
    all_references: sum(references),
    scripts_never_loaded: sum(scripts),
    whole_bundle: sum(files),
  };

  const verdicts = {
    lint_pass_text: scriptOutput([lint, sample, '--keywords', 'airflow,dbt,snowflake,kubernetes']),
    lint_pass_json: scriptOutput([lint, sample, '--json']),
    lint_failing_text: scriptOutput([lint, bad]),
    resume_document: countFile(path.join(ROOT, sample)),
  };

  process.stdout.write(`method: ${method}\n\nPer file\n`);
  files.forEach((f) => {
    process.stdout.write(`  ${String(f.tokens).padStart(6)}  ${f.file}\n`);
  });

  process.stdout.write('\nDisclosure layers\n');
  Object.entries(layers).forEach(([k, v]) => {
    process.stdout.write(`  ${String(v).padStart(6)}  ${k}\n`);
  });

  process.stdout.write('\nPer-call costs\n');
  Object.entries(verdicts).forEach(([k, v]) => {
    process.stdout.write(`  ${String(v).padStart(6)}  ${k}\n`);
  });

  const inlined = layers.skill_md_on_trigger + layers.all_references;
  const typicalRun = layers.metadata_description_always_resident + layers.skill_md_on_trigger +
    layers.one_reference_max + verdicts.lint_pass_text + verdicts.lint_pass_json;

  process.stdout.write(
    '\nDerived\n' +
      `  ${String(inlined).padStart(6)}  same content with every reference inlined into SKILL.md\n` +
      `  ${String(typicalRun).padStart(6)}  typical run: metadata + SKILL.md + one reference + two verdicts\n` +
      `  ${String(Math.round((1 - layers.skill_md_on_trigger / inlined) * 100)).padStart(6)}%  less at trigger time than the inlined variant\n` +
      `  ${String(Math.round((1 - typicalRun / layers.whole_bundle) * 100)).padStart(6)}%  less than reading the whole bundle\n`
  );

  if (process.argv.includes('--json')) {
    fs.writeFileSync(
      path.join(ROOT, 'docs', 'token-measurements.json'),
      JSON.stringify({ method, files, layers, verdicts, derived: { inlined, typicalRun } }, null, 2) + '\n'
    );
    process.stdout.write('\nwrote docs/token-measurements.json\n');
  }
}

main();
