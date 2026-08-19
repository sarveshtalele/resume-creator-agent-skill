#!/usr/bin/env node
/**
 * e2e.test.js — end-to-end check of the resume-architect pipeline.
 * Zero dependencies, runs with plain `node test/e2e.test.js`.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILL = path.join(ROOT, 'skills', 'resume-architect');
const LINT = path.join(SKILL, 'scripts', 'lint-resume.js');
const TOPDF = path.join(SKILL, 'scripts', 'md-to-pdf.js');
const EXTRACT = path.join(SKILL, 'scripts', 'extract-linkedin.js');
const GOOD = path.join(__dirname, 'fixtures', 'sample-resume.md');
const BAD = path.join(__dirname, 'fixtures', 'bad-resume.md');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-e2e-'));
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ok   ${name}\n`);
  } catch (err) {
    failed++;
    process.stdout.write(`  FAIL ${name}\n       ${err.message}\n`);
  }
}

function node(script, args) {
  return spawnSync(process.execPath, [script].concat(args), { encoding: 'utf8' });
}

function which(bin) {
  const res = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.split('\n')[0].trim() : null;
}

process.stdout.write('resume-architect end-to-end suite\n');

/* ---------------- skill bundle integrity ---------------- */

test('every file the SKILL.md references exists', () => {
  const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
  const body = md.replace(/```[\s\S]*?```/g, '');
  const refs = new Set();
  for (const m of body.matchAll(/`((?:scripts|references|assets)\/[\w./-]+)`/g)) refs.add(m[1]);
  for (const m of body.matchAll(/\]\(((?:scripts|references|assets)\/[\w./-]+)\)/g)) refs.add(m[1]);
  assert.ok(refs.size >= 10, `expected the bundle to be referenced, found ${refs.size}`);
  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(SKILL, ref)), `missing referenced file: ${ref}`);
  }
});

test('every bundled file is referenced from SKILL.md', () => {
  const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const dir of ['scripts', 'references', 'assets']) {
    for (const f of fs.readdirSync(path.join(SKILL, dir))) {
      assert.ok(md.includes(`${dir}/${f}`), `bundled but unreferenced: ${dir}/${f}`);
    }
  }
});

test('SKILL.md frontmatter is valid and under the line budget', () => {
  const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
  const fm = md.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'no frontmatter block');
  assert.ok(/\nname: resume-architect\n/.test('\n' + fm[1] + '\n'), 'name must match the folder');
  assert.ok(/description:/.test(fm[1]), 'description missing');
  assert.ok(/use this whenever/i.test(fm[1]), 'description needs trigger language');
  assert.ok(md.split('\n').length <= 500, 'SKILL.md over 500 lines');
});

test('evals.json parses and its file assertions resolve', () => {
  const evals = JSON.parse(fs.readFileSync(path.join(SKILL, 'evals', 'evals.json'), 'utf8'));
  assert.ok(evals.evals.length >= 5, 'expected at least 5 eval cases');
  evals.evals.forEach((e) => {
    assert.ok(e.assertions.length > 0, `${e.id} has no assertions`);
    e.assertions
      .filter((a) => a.startsWith('file:'))
      .forEach((a) => {
        const rel = a.slice(5);
        assert.ok(fs.existsSync(path.join(SKILL, rel)), `${e.id} references missing ${rel}`);
      });
  });
});

/* ---------------- validator ---------------- */

test('validator passes the reference resume and fits one page', () => {
  const res = node(LINT, [GOOD, '--json']);
  assert.strictEqual(res.status, 0, `expected exit 0, got ${res.status}: ${res.stdout}${res.stderr}`);
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.errors.length, 0);
  assert.ok(report.stats.estimated_page_fill_percent <= 100, `fill ${report.stats.estimated_page_fill_percent}%`);
  assert.ok(report.stats.bullets >= 10, 'expected a realistic bullet count');
});

test('validator catches the seeded defects', () => {
  const res = node(LINT, [BAD, '--json']);
  assert.strictEqual(res.status, 1, 'a broken resume must exit 1');
  const codes = JSON.parse(res.stdout).errors.map((e) => e.code);
  ['E-EMAIL', 'E-SECTION', 'E-DATEFMT', 'E-PRONOUN', 'E-GLYPH', 'E-TABLE'].forEach((code) => {
    assert.ok(codes.includes(code), `expected ${code} in ${codes.join(',')}`);
  });
});

test('keyword coverage is scored', () => {
  const res = node(LINT, [GOOD, '--keywords', 'airflow,dbt,snowflake,kubernetes', '--json']);
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.keywords.total, 4);
  assert.strictEqual(report.keywords.coverage, 75);
  assert.deepStrictEqual(report.keywords.missing, ['kubernetes']);
});

test('the blank skeleton uses only standard section headings', () => {
  const skeleton = fs.readFileSync(path.join(SKILL, 'assets', 'resume-template.md'), 'utf8');
  const { parse } = require(LINT);
  const doc = parse(skeleton);
  const standard = fs.readFileSync(LINT, 'utf8').toLowerCase();
  assert.ok(doc.name, 'skeleton has a name heading');
  assert.ok(doc.contact, 'skeleton has a contact line');
  doc.sections.forEach((s) => {
    assert.ok(standard.includes(`'${s.title.toLowerCase()}'`), `non-standard heading in skeleton: ${s.title}`);
  });
  assert.ok(doc.sections.length >= 5, 'skeleton covers the core sections');
});

/* ---------------- renderer ---------------- */

test('markdown dialect renders to the expected HTML structure', () => {
  const { renderBody } = require(TOPDF);
  const html = renderBody(fs.readFileSync(GOOD, 'utf8'));
  assert.ok(html.includes('<h1>Jane Doe</h1>'), 'name heading');
  assert.ok(html.includes('<div class="contact">'), 'contact line');
  assert.ok(html.includes('<h2>Professional Experience</h2>'), 'section heading');
  assert.ok(html.includes('<div class="org"><span class="left">Acme Analytics</span>'), 'organisation row');
  assert.ok(html.includes('<span class="right">Mar 2022 – Present</span>'), 'date alignment');
  assert.ok(html.includes('<span class="skilllabel">Languages:</span>'), 'skills row');
  assert.ok(!/<table|<img/.test(html), 'no tables or images may be emitted');
});

test('html-only mode writes a self-contained page', () => {
  const out = path.join(tmp, 'html-only.pdf');
  const res = node(TOPDF, [GOOD, '-o', out, '--html-only', '--json']);
  assert.strictEqual(res.status, 0, res.stderr);
  const html = fs.readFileSync(JSON.parse(res.stdout).html, 'utf8');
  assert.ok(html.includes('@page { size: Letter'), 'page box present');
  assert.ok(html.includes('font-family: Calibri'), 'stylesheet inlined');
});

/* ---------------- pdf pipeline ---------------- */

const { findChrome, countPages } = require(TOPDF);
const engine = findChrome() || which('wkhtmltopdf') || which('weasyprint');

if (!engine) {
  process.stdout.write('  skip PDF render tests — no rendering engine installed\n');
} else {
  test('markdown renders to a one-page PDF', () => {
    const out = path.join(tmp, 'resume.pdf');
    const res = node(TOPDF, [GOOD, '-o', out, '--json']);
    assert.strictEqual(res.status, 0, res.stderr);
    const report = JSON.parse(res.stdout);
    assert.ok(fs.existsSync(out), 'pdf missing');
    assert.ok(report.bytes > 5000, `pdf suspiciously small: ${report.bytes}`);
    assert.strictEqual(report.pages, 1, `expected 1 page, got ${report.pages}`);
  });

  test('A4 renders and stays one page', () => {
    const out = path.join(tmp, 'resume-a4.pdf');
    const res = node(TOPDF, [GOOD, '-o', out, '--format', 'A4', '--json']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(JSON.parse(res.stdout).pages, 1);
  });

  test('the validator predicts overflow that the renderer then confirms', () => {
    const long = path.join(tmp, 'long.md');
    const base = fs.readFileSync(GOOD, 'utf8');
    const filler = Array.from(
      { length: 12 },
      (_, i) => `- Delivered improvement number ${i} across 6 teams and 3 regions, cutting cycle time from 42 minutes to 7 and halving repeat escalations.`
    ).join('\n');
    fs.writeFileSync(long, base + '\n' + filler + '\n');

    const lintRes = node(LINT, [long, '--json']);
    const report = JSON.parse(lintRes.stdout);
    assert.strictEqual(lintRes.status, 1, 'overflowing content must fail validation');
    assert.ok(report.errors.some((e) => e.code === 'E-OVERFLOW'), 'expected E-OVERFLOW');
    assert.ok(report.stats.estimated_page_fill_percent > 100);

    const out = path.join(tmp, 'long.pdf');
    node(TOPDF, [long, '-o', out, '--json']);
    assert.ok(countPages(out) > 1, 'the renderer must agree the content overflows');
  });

  test('content the validator passes at the limit still renders on one page', () => {
    const tight = path.join(tmp, 'tight.md');
    const base = fs.readFileSync(GOOD, 'utf8');
    const filler = Array.from(
      { length: 4 },
      (_, i) => `- Automated release verification for service ${i}, removing 9 hours of manual checks each week.`
    ).join('\n');
    fs.writeFileSync(tight, base + '\n' + filler + '\n');

    const report = JSON.parse(node(LINT, [tight, '--json']).stdout);
    assert.ok(report.stats.estimated_page_fill_percent > 90, 'fixture should sit near the limit');
    assert.strictEqual(report.errors.length, 0, 'validator should accept it');

    const out = path.join(tmp, 'tight.pdf');
    const res = node(TOPDF, [tight, '-o', out, '--json']);
    assert.strictEqual(JSON.parse(res.stdout).pages, 1, 'accepted content must fit one page');
  });

  const pdftotext = which('pdftotext');
  if (!pdftotext) {
    process.stdout.write('  skip text-extraction tests — pdftotext not installed\n');
  } else {
    test('rendered PDF is text-selectable in document order', () => {
      const out = path.join(tmp, 'resume.pdf');
      const res = spawnSync(pdftotext, ['-layout', out, '-'], { encoding: 'utf8' });
      const text = res.stdout;
      const flat = text.toLowerCase();
      assert.ok(text.trim().startsWith('Jane Doe'), 'name must be the first text');
      // headings render uppercase via CSS, so compare case-insensitively as parsers do
      ['jane.doe@example.com', 'professional summary', 'skills', 'professional experience',
        'acme analytics', 'senior data engineer', 'mar 2022 – present', 'education',
        'rice university'].forEach((needle) => {
        assert.ok(flat.includes(needle), `parser cannot see: ${needle}`);
      });
      assert.ok(flat.indexOf('professional summary') < flat.indexOf('professional experience'), 'section order');
      assert.ok(text.indexOf('Acme Analytics') < text.indexOf('Senior Data Engineer'), 'company must precede title');
    });

    test('extractor round-trips a rendered profile PDF to text', () => {
      const out = path.join(tmp, 'profile.txt');
      const res = node(EXTRACT, [path.join(tmp, 'resume.pdf'), '-o', out, '--json']);
      assert.strictEqual(res.status, 0, res.stderr);
      const report = JSON.parse(res.stdout);
      assert.ok(report.characters > 500, 'extraction too small');
      assert.ok(fs.readFileSync(out, 'utf8').includes('Jane Doe'));
    });
  }
}

/* ---------------- installer ---------------- */

test('installer copies the bundle and uninstalls cleanly', () => {
  const { install, uninstall } = require(path.join(ROOT, 'lib', 'install.js'));
  const projectRoot = path.join(tmp, 'project');
  fs.mkdirSync(projectRoot, { recursive: true });

  const res = install({ dir: projectRoot });
  const dest = path.join(projectRoot, '.claude', 'skills', 'resume-architect');
  assert.strictEqual(res.dest, dest);
  assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')), 'SKILL.md not copied');
  assert.ok(fs.existsSync(path.join(dest, 'scripts', 'md-to-pdf.js')), 'scripts not copied');
  assert.ok(fs.existsSync(path.join(dest, 'assets', 'resume.css')), 'assets not copied');
  assert.ok(res.files >= 12, `expected the full bundle, copied ${res.files}`);

  assert.strictEqual(install({ dir: projectRoot }).status, 'exists', 'second install must not clobber');
  assert.strictEqual(install({ dir: projectRoot, force: true }).status, 'installed', 'force must replace');
  assert.strictEqual(uninstall({ dir: projectRoot }).status, 'uninstalled');
  assert.ok(!fs.existsSync(dest), 'uninstall left files behind');
});

test('installed copy runs the converter from its new location', () => {
  const projectRoot = path.join(tmp, 'project2');
  fs.mkdirSync(projectRoot, { recursive: true });
  const { install } = require(path.join(ROOT, 'lib', 'install.js'));
  const dest = install({ dir: projectRoot }).dest;
  const res = node(path.join(dest, 'scripts', 'lint-resume.js'), [GOOD, '--json']);
  assert.strictEqual(res.status, 0, res.stderr);
});

test('cli help and list run without error', () => {
  const help = node(path.join(ROOT, 'bin', 'cli.js'), ['--help']);
  assert.strictEqual(help.status, 0);
  assert.ok(help.stdout.includes('npx resume-architect-skill'));
  const list = node(path.join(ROOT, 'bin', 'cli.js'), ['list']);
  assert.strictEqual(list.status, 0);
  assert.ok(/project/.test(list.stdout) && /global/.test(list.stdout));
});

fs.rmSync(tmp, { recursive: true, force: true });

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
