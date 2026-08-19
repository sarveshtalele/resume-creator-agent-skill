#!/usr/bin/env node
/**
 * lint-resume.js — ATS + one-page validator for the resume Markdown dialect.
 *
 * Zero npm dependencies. Enforces the structural contract in
 * references/ats-template.md, estimates rendered page fill before any PDF is
 * produced, and (optionally) scores keyword coverage against the job posting.
 *
 * Usage:
 *   node lint-resume.js <resume.md> [--keywords "a,b,c"] [--keywords-file <f>]
 *                       [--format Letter|A4] [--json]
 *
 * Exit codes: 0 clean (warnings allowed) | 1 errors found | 2 bad input
 */
'use strict';

const fs = require('fs');

const STANDARD_SECTIONS = [
  'professional summary',
  'summary',
  'skills',
  'technical skills',
  'core competencies',
  'professional experience',
  'work experience',
  'experience',
  'education',
  'certifications',
  'licenses and certifications',
  'projects',
  'selected projects',
  'publications',
  'awards',
  'volunteer experience',
  'additional information',
];

const REQUIRED_SECTIONS = [
  ['professional summary', 'summary'],
  ['skills', 'technical skills', 'core competencies'],
  ['professional experience', 'work experience', 'experience'],
];

const WEAK_OPENERS = [
  'responsible', 'worked', 'helped', 'assisted', 'participated', 'involved',
  'tasked', 'duties', 'handled', 'various', 'successfully', 'utilized',
];

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
const DATE_TOKEN = `(?:${MONTHS})\\s+\\d{4}`;
const DATE_RANGE = new RegExp(`^(?:${DATE_TOKEN}|\\d{4})\\s+[–]\\s+(?:${DATE_TOKEN}|\\d{4}|Present)$`);
const SINGLE_DATE = new RegExp(`^(?:${DATE_TOKEN}|\\d{4})$`);
const EMOJI = /[←-⇿⌀-➿⬀-⯿️\u{1F000}-\u{1FAFF}]/u;
const PRONOUN = /^(i|i'm|my|me|we|our|us)\b/i;

const PAGE = {
  Letter: { height: 720, charsLi: 104, charsP: 107 },
  A4: { height: 769, charsLi: 100, charsP: 103 },
};

const LINE = 13.0; // 10.5pt at line-height 1.24, rounded up

function wrapped(text, perLine) {
  return Math.max(1, Math.ceil(text.length / perLine));
}

function parse(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const doc = { name: null, contact: null, sections: [], raw: lines };
  let current = null;
  let seenH1 = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.startsWith('# ')) {
      doc.name = { text: t.slice(2).trim(), line: i + 1 };
      seenH1 = true;
      continue;
    }
    if (t.startsWith('## ')) {
      current = { title: t.slice(3).trim(), line: i + 1, entries: [], bullets: [], body: [] };
      doc.sections.push(current);
      continue;
    }
    if (t.startsWith('### ')) {
      if (current) current.entries.push({ text: t.slice(4).trim(), line: i + 1, bullets: [], role: null });
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      const bullet = { text: t.replace(/^[-*]\s+/, ''), line: i + 1, marker: t[0] };
      if (current) {
        current.bullets.push(bullet);
        const entry = current.entries[current.entries.length - 1];
        if (entry) entry.bullets.push(bullet);
      }
      continue;
    }
    if (/^\*\*[^*]+\*\*/.test(t)) {
      if (current) {
        const isSkillRow = /^\*\*[^*]+:\*\*/.test(t);
        const entry = current.entries[current.entries.length - 1];
        // a role line belongs to its entry, not to the section body, so the
        // page-fill estimate counts it exactly once
        if (!isSkillRow && entry && !entry.role) entry.role = { text: t, line: i + 1 };
        else current.body.push({ text: t, line: i + 1, kind: isSkillRow ? 'skillrow' : 'role' });
      }
      continue;
    }
    if (seenH1 && !doc.contact && !current) {
      doc.contact = { text: t, line: i + 1 };
      continue;
    }
    if (current) current.body.push({ text: t, line: i + 1, kind: 'p' });
  }
  return doc;
}

function estimateFill(doc, format) {
  const cfg = PAGE[format];
  let pt = 0;
  if (doc.name) pt += 22.9;
  if (doc.contact) pt += 19.8;
  doc.sections.forEach((s, idx) => {
    pt += idx === 0 ? 24.2 : 27.2;
    s.entries.forEach((e) => {
      pt += 18.0;
      if (e.role) pt += 14.5;
    });
    s.body.forEach((b) => {
      if (b.kind === 'skillrow') pt += wrapped(b.text, cfg.charsP) * LINE + 2;
      else if (b.kind === 'role') pt += 14.5;
      else pt += wrapped(b.text, cfg.charsP) * LINE + 3;
    });
    s.bullets.forEach((b) => {
      pt += wrapped(b.text, cfg.charsLi) * LINE + 1.5;
    });
    if (s.bullets.length) pt += 1;
  });
  return { points: Math.round(pt), capacity: cfg.height, fill: Math.round((pt / cfg.height) * 100) };
}

function lint(md, opts) {
  const doc = parse(md);
  const errors = [];
  const warnings = [];
  const add = (list, line, code, message) => list.push({ line, code, message });

  const h1Count = (md.match(/^#\s+/gm) || []).length;
  if (!doc.name) add(errors, 0, 'E-NAME', 'No `# Full Name` heading found on the first content line.');
  if (h1Count > 1) add(errors, 0, 'E-H1', `Found ${h1Count} level-1 headings; the name must be the only one.`);

  if (!doc.contact) {
    add(errors, 0, 'E-CONTACT', 'No contact line directly under the name heading.');
  } else {
    if (!/[\w.+-]+@[\w-]+\.[\w.]+/.test(doc.contact.text)) {
      add(errors, doc.contact.line, 'E-EMAIL', 'Contact line has no email address.');
    }
    if (!/\d{3}/.test(doc.contact.text)) {
      add(warnings, doc.contact.line, 'W-PHONE', 'Contact line has no phone number.');
    }
    if (doc.contact.text.length > 140) {
      add(warnings, doc.contact.line, 'W-CONTACT-LEN', 'Contact line is long; it may wrap to a second line.');
    }
  }

  const titles = doc.sections.map((s) => s.title.toLowerCase());
  REQUIRED_SECTIONS.forEach((group) => {
    if (!group.some((g) => titles.includes(g))) {
      add(errors, 0, 'E-SECTION', `Missing a required section: one of ${group.join(' / ')}.`);
    }
  });
  if (!titles.includes('education')) {
    add(warnings, 0, 'W-EDU', 'No Education section; most parsers expect one.');
  }
  doc.sections.forEach((s) => {
    if (!STANDARD_SECTIONS.includes(s.title.toLowerCase())) {
      add(warnings, s.line, 'W-HEADING', `"${s.title}" is not a standard ATS heading; parsers may skip the block.`);
    }
  });

  doc.sections.forEach((s) => {
    s.entries.forEach((e) => {
      if (!/ — /.test(e.text)) {
        add(warnings, e.line, 'W-ORG', `Entry "${e.text}" should read "Organisation — City, ST".`);
      }
      if (!e.role) {
        add(errors, e.line, 'E-ROLE', `Entry "${e.text}" has no "**Title** | Mon YYYY – Mon YYYY" line beneath it.`);
        return;
      }
      const parts = e.role.text.split('|').map((p) => p.trim());
      if (parts.length < 2) {
        add(errors, e.role.line, 'E-DATEFIELD', 'Role line needs a " | " separator before the date range.');
        return;
      }
      const dates = parts[parts.length - 1];
      if (!DATE_RANGE.test(dates) && !SINGLE_DATE.test(dates)) {
        add(
          errors,
          e.role.line,
          'E-DATEFMT',
          `Dates "${dates}" must read "Mon YYYY – Mon YYYY", "Mon YYYY – Present", or a single "Mon YYYY".`
        );
      }
    });
  });

  const allBullets = doc.sections.reduce((acc, s) => acc.concat(s.bullets), []);
  if (!allBullets.length) add(errors, 0, 'E-BULLETS', 'No bullet points found.');
  let quantified = 0;
  allBullets.forEach((b) => {
    if (b.marker !== '-') add(warnings, b.line, 'W-MARKER', 'Use "- " as the bullet marker for consistency.');
    if (PRONOUN.test(b.text)) add(errors, b.line, 'E-PRONOUN', 'Bullet starts with a personal pronoun.');
    if (/[•▪●✦➤✓]/.test(b.text)) {
      add(errors, b.line, 'E-GLYPH', 'Bullet contains a decorative glyph that parsers drop.');
    }
    if (EMOJI.test(b.text)) add(errors, b.line, 'E-EMOJI', 'Bullet contains an emoji.');
    if (b.text.endsWith('.') === false && b.text.length > 40) {
      /* trailing period is a style choice, not a parser issue */
    }
    if (b.text.length > 230) add(warnings, b.line, 'W-LONG', `Bullet is ${b.text.length} chars; trim toward 150-200.`);
    const opener = b.text.replace(/^\*+/, '').split(/\s+/)[0].toLowerCase().replace(/[^a-z']/g, '');
    if (WEAK_OPENERS.includes(opener)) {
      add(warnings, b.line, 'W-VERB', `Bullet opens with the weak verb "${opener}"; lead with an outcome verb.`);
    }
    if (/\d/.test(b.text)) quantified++;
  });
  if (allBullets.length && quantified / allBullets.length < 0.5) {
    add(
      warnings,
      0,
      'W-METRICS',
      `Only ${quantified}/${allBullets.length} bullets carry a number; aim for at least half quantified.`
    );
  }

  doc.sections.forEach((s) => {
    s.entries.forEach((e) => {
      if (e.bullets.length > 6) {
        add(warnings, e.line, 'W-DENSITY', `"${e.text}" has ${e.bullets.length} bullets; cap at 6 for the newest role.`);
      }
    });
  });

  if (/^\s*\|/m.test(md) || /\|\s*-{3,}/.test(md)) {
    add(errors, 0, 'E-TABLE', 'Markdown table detected; tables scramble in ATS parsers.');
  }
  if (/!\[[^\]]*\]\(/.test(md)) add(errors, 0, 'E-IMAGE', 'Image detected; ATS parsers cannot read images.');
  if (/<[a-z][^>]*>/i.test(md.replace(/`[^`]*`/g, ''))) {
    add(warnings, 0, 'W-HTML', 'Raw HTML detected; keep the file to plain Markdown.');
  }
  if (EMOJI.test(md)) add(errors, 0, 'E-EMOJI-DOC', 'Emoji found in the document.');

  const fit = estimateFill(doc, opts.format);
  if (fit.fill > 100) {
    add(errors, 0, 'E-OVERFLOW', `Estimated ${fit.fill}% of one ${opts.format} page; cut content until it is at or under 100%.`);
  } else if (fit.fill > 96) {
    add(warnings, 0, 'W-TIGHT', `Estimated ${fit.fill}% page fill; very little slack for font substitution.`);
  } else if (fit.fill < 70) {
    add(warnings, 0, 'W-SPARSE', `Estimated ${fit.fill}% page fill; the page will look thin.`);
  }

  let keywords = null;
  if (opts.keywords && opts.keywords.length) {
    const haystack = md.toLowerCase();
    const matched = [];
    const missing = [];
    opts.keywords.forEach((k) => {
      (haystack.includes(k.toLowerCase().trim()) ? matched : missing).push(k.trim());
    });
    const coverage = Math.round((matched.length / opts.keywords.length) * 100);
    keywords = { total: opts.keywords.length, matched, missing, coverage };
    if (coverage < 70) {
      add(warnings, 0, 'W-KEYWORDS', `Keyword coverage is ${coverage}%; work the missing terms into real bullets.`);
    }
  }

  return {
    file: opts.file,
    format: opts.format,
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      sections: doc.sections.length,
      entries: doc.sections.reduce((n, s) => n + s.entries.length, 0),
      bullets: allBullets.length,
      quantified_bullets: quantified,
      estimated_points: fit.points,
      page_capacity_points: fit.capacity,
      estimated_page_fill_percent: fit.fill,
    },
    keywords,
  };
}

function parseArgs(argv) {
  const opts = { format: 'Letter', json: false, keywords: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format') opts.format = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--keywords') opts.keywords = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--keywords-file') opts.keywordsFile = argv[++i];
    else rest.push(a);
  }
  opts.file = rest[0];
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file || !fs.existsSync(opts.file)) {
    process.stderr.write('usage: node lint-resume.js <resume.md> [--keywords "a,b"] [--format Letter|A4] [--json]\n');
    process.exit(2);
  }
  opts.format = /^a4$/i.test(opts.format) ? 'A4' : 'Letter';
  if (opts.keywordsFile && fs.existsSync(opts.keywordsFile)) {
    opts.keywords = opts.keywords.concat(
      fs.readFileSync(opts.keywordsFile, 'utf8').split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    );
  }

  const report = lint(fs.readFileSync(opts.file, 'utf8'), opts);

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    const s = report.stats;
    process.stdout.write(
      `${report.ok ? 'PASS' : 'FAIL'} ${opts.file} — ${report.errors.length} error(s), ${report.warnings.length} warning(s)\n` +
        `  layout: ${s.estimated_page_fill_percent}% of one ${report.format} page ` +
        `(${s.sections} sections, ${s.entries} entries, ${s.bullets} bullets, ${s.quantified_bullets} quantified)\n`
    );
    report.errors.forEach((e) => process.stdout.write(`  ERROR   ${e.code} line ${e.line}: ${e.message}\n`));
    report.warnings.forEach((w) => process.stdout.write(`  WARNING ${w.code} line ${w.line}: ${w.message}\n`));
    if (report.keywords) {
      process.stdout.write(
        `  keywords: ${report.keywords.coverage}% covered` +
          (report.keywords.missing.length ? ` — missing: ${report.keywords.missing.join(', ')}\n` : '\n')
      );
    }
  }

  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { lint, parse, estimateFill };
