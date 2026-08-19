#!/usr/bin/env node
/**
 * extract-linkedin.js — Turn an exported LinkedIn profile PDF into clean text.
 *
 * Zero npm dependencies: shells out to whichever local text extractor exists
 * (pdftotext, then mutool). When neither is installed it exits with code 4 so
 * the calling agent falls back to reading the PDF with its own file reader.
 *
 * Usage:
 *   node extract-linkedin.js <profile.pdf> [-o <out.txt>] [--json]
 *
 * Exit codes: 0 ok | 2 bad input | 4 no extractor available
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SECTION_HINTS = [
  'Contact', 'Top Skills', 'Languages', 'Certifications', 'Honors-Awards', 'Honors & Awards',
  'Publications', 'Summary', 'Experience', 'Education', 'Projects', 'Volunteering',
  'Licenses & Certifications', 'Skills',
];

function which(bin) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(finder, [bin], { encoding: 'utf8' });
  if (res.status === 0 && res.stdout) {
    const first = res.stdout.split('\n')[0].trim();
    if (first) return first;
  }
  return null;
}

function extract(pdfPath) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-')), 'profile.txt');

  const pdftotext = which('pdftotext');
  if (pdftotext) {
    const res = spawnSync(pdftotext, ['-layout', '-enc', 'UTF-8', pdfPath, tmp], { encoding: 'utf8' });
    if (res.status === 0 && fs.existsSync(tmp)) {
      return { text: fs.readFileSync(tmp, 'utf8'), extractor: 'pdftotext' };
    }
  }

  const mutool = which('mutool');
  if (mutool) {
    const res = spawnSync(mutool, ['draw', '-F', 'txt', '-o', tmp, pdfPath], { encoding: 'utf8' });
    if (res.status === 0 && fs.existsSync(tmp)) {
      return { text: fs.readFileSync(tmp, 'utf8'), extractor: 'mutool' };
    }
  }

  return null;
}

function clean(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => !/^\s*Page \d+ of \d+\s*$/i.test(l))
    .filter((l) => !/^\s*https:\/\/www\.linkedin\.com\/in\/[^\s]+\s+\(LinkedIn\)\s*$/i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectSections(text) {
  const found = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const t = line.trim();
    if (SECTION_HINTS.some((h) => h.toLowerCase() === t.toLowerCase())) {
      found.push({ heading: t, line: i + 1 });
    }
  });
  return found;
}

function main() {
  const argv = process.argv.slice(2);
  const rest = [];
  let out = null;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-o' || argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--json') asJson = true;
    else rest.push(argv[i]);
  }
  const input = rest[0];

  if (!input || !fs.existsSync(input)) {
    process.stderr.write('usage: node extract-linkedin.js <profile.pdf> [-o out.txt] [--json]\n');
    process.exit(2);
  }

  const result = extract(input);
  if (!result) {
    process.stderr.write(
      'error: no local PDF text extractor found (pdftotext or mutool).\n' +
        'Read the PDF directly with the agent file reader instead, then continue the intake.\n'
    );
    process.exit(4);
  }

  const text = clean(result.text);
  const outPath = path.resolve(out || input.replace(/\.pdf$/i, '') + '.txt');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text + '\n', 'utf8');

  const report = {
    source: path.resolve(input),
    output: outPath,
    extractor: result.extractor,
    characters: text.length,
    lines: text.split('\n').length,
    sections: detectSections(text),
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(
      `Extracted ${report.characters} chars via ${report.extractor} -> ${outPath}\n` +
        `Detected sections: ${report.sections.map((s) => s.heading).join(', ') || 'none'}\n`
    );
  }
}

if (require.main === module) main();

module.exports = { clean, detectSections };
