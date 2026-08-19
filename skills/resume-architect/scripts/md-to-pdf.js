#!/usr/bin/env node
/**
 * md-to-pdf.js — Deterministic Markdown resume -> print-ready PDF converter.
 *
 * Zero npm dependencies. Renders the constrained resume Markdown dialect
 * documented in references/ats-template.md into a single-column HTML page,
 * then prints it to PDF with a locally installed rendering engine.
 *
 * Usage:
 *   node md-to-pdf.js <resume.md> [-o <out.pdf>] [--css <file.css>]
 *                     [--format Letter|A4] [--engine auto|chrome|wkhtmltopdf|weasyprint]
 *                     [--html-only] [--json]
 *
 * Exit codes: 0 ok | 2 bad input | 3 no rendering engine | 4 render failed
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 60000;

/* ------------------------------------------------------------------ *
 * Markdown subset renderer
 * ------------------------------------------------------------------ */

const EM_DASH = '—';
const EN_DASH = '–';
const MIDDOT = '·';

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}

function splitRow(text, seps) {
  for (const sep of seps) {
    const idx = text.indexOf(sep);
    if (idx > 0) {
      return [text.slice(0, idx).trim(), text.slice(idx + sep.length).trim()];
    }
  }
  return [text.trim(), ''];
}

function row(leftRaw, rightRaw, cls) {
  const left = `<span class="left">${inline(leftRaw)}</span>`;
  const right = rightRaw ? `<span class="right">${inline(rightRaw)}</span>` : '';
  return `<div class="${cls}">${left}${right}</div>`;
}

/**
 * Convert the resume Markdown dialect to body HTML.
 * Recognised blocks: H1 name, contact paragraph, H2 section, H3 organisation,
 * bold role line, "- " bullets, "**Label:** values" skill rows, plain paragraphs.
 */
function renderBody(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inList = false;
  let seenH1 = false;
  let contactTaken = false;
  let section = '';

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      closeList();
      continue;
    }

    if (trimmed.startsWith('# ')) {
      closeList();
      html.push(`<h1>${inline(trimmed.slice(2).trim())}</h1>`);
      seenH1 = true;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeList();
      section = trimmed.slice(3).trim();
      html.push(`<h2>${inline(section)}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      closeList();
      const [l, r] = splitRow(trimmed.slice(4).trim(), [` ${EM_DASH} `, ' -- ']);
      html.push(row(l, r, 'org'));
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\*\*[^*]+\*\*/.test(trimmed)) {
      closeList();
      if (/^\*\*[^*]+:\*\*/.test(trimmed)) {
        const m = trimmed.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
        html.push(
          `<div class="skillrow"><span class="skilllabel">${inline(m[1])}:</span> ${inline(m[2])}</div>`
        );
      } else {
        const [l, r] = splitRow(trimmed, [' | ', ` ${MIDDOT} `]);
        html.push(row(l, r, 'role'));
      }
      continue;
    }

    closeList();
    if (seenH1 && !contactTaken && !section) {
      html.push(`<div class="contact">${inline(trimmed)}</div>`);
      contactTaken = true;
      continue;
    }
    html.push(`<p>${inline(trimmed)}</p>`);
  }

  closeList();
  return html.join('\n');
}

function buildHtml(md, css, format) {
  const title = (md.match(/^#\s+(.+)$/m) || [null, 'Resume'])[1].trim();
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>@page { size: ${format}; margin: 0.5in; }`,
    css,
    '</style></head><body>',
    renderBody(md),
    '</body></html>',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Rendering engines
 * ------------------------------------------------------------------ */

function chromeCandidates() {
  const envPath = process.env.RESUME_CHROME || process.env.CHROME_PATH;
  const list = envPath ? [envPath] : [];
  if (process.platform === 'darwin') {
    list.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (process.platform === 'win32') {
    const bases = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']];
    for (const base of bases.filter(Boolean)) {
      list.push(
        path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      );
    }
  } else {
    list.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/snap/bin/chromium'
    );
  }
  return list;
}

function which(bin) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(finder, [bin], { encoding: 'utf8' });
  if (res.status === 0 && res.stdout) {
    const first = res.stdout.split('\n')[0].trim();
    if (first) return first;
  }
  return null;
}

function findChrome() {
  for (const candidate of chromeCandidates()) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser', 'msedge']) {
    const resolved = which(bin);
    if (resolved) return resolved;
  }
  return null;
}

function fileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  return 'file://' + (abs.startsWith('/') ? '' : '/') + encodeURI(abs);
}

/**
 * Run a rendering engine and resolve as soon as the PDF is completely written.
 *
 * Headless Chrome writes the file and then lingers (updater, background
 * networking), so waiting for process exit can hang for minutes. Poll for the
 * output instead, accept it once its size stops changing, and stop the process.
 */
function runEngine(bin, args, pdfPath, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    let settled = false;
    let lastSize = -1;
    let stableTicks = 0;
    let poll;
    const errors = [];

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      if (child && child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (_) {
          try {
            child.kill('SIGKILL');
          } catch (__) {
            /* process already gone */
          }
        }
      }
      resolve(result);
    };

    try {
      child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], detached: process.platform !== 'win32' });
    } catch (err) {
      resolve({ ok: false, detail: String(err.message) });
      return;
    }

    if (child.stderr) child.stderr.on('data', (d) => errors.push(String(d)));
    child.on('error', (err) => finish({ ok: false, detail: String(err.message) }));
    child.on('exit', () => finish({ ok: fs.existsSync(pdfPath), detail: errors.join('').slice(-400) }));

    const started = Date.now();
    poll = setInterval(() => {
      if (fs.existsSync(pdfPath)) {
        const size = fs.statSync(pdfPath).size;
        if (size > 1000 && size === lastSize) {
          stableTicks++;
          if (stableTicks >= 2) finish({ ok: true, detail: '' });
        } else {
          stableTicks = 0;
        }
        lastSize = size;
      }
      if (Date.now() - started > timeoutMs) {
        finish({ ok: fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1000, detail: 'engine timed out' });
      }
    }, 200);
  });
}

function chromeArgs(htmlPath, pdfPath, profile) {
  const args = [
    '--disable-gpu',
    '--disable-extensions',
    '--disable-lcd-text',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--mute-audio',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-pdf-header-footer',
    '--virtual-time-budget=3000',
    `--user-data-dir=${profile}`,
    `--print-to-pdf=${pdfPath}`,
    fileUrl(htmlPath),
  ];
  if (process.platform !== 'win32' && typeof process.getuid === 'function' && process.getuid() === 0) {
    args.unshift('--no-sandbox');
  }
  return args;
}

async function runChrome(bin, htmlPath, pdfPath, timeoutMs) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-chrome-'));
  let res = await runEngine(bin, ['--headless=new'].concat(chromeArgs(htmlPath, pdfPath, profile)), pdfPath, timeoutMs);
  if (!res.ok) {
    res = await runEngine(bin, ['--headless'].concat(chromeArgs(htmlPath, pdfPath, profile)), pdfPath, timeoutMs);
  }
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch (_) {
    /* temp profile cleanup is best effort */
  }
  return res;
}

function runWkhtml(bin, htmlPath, pdfPath, format, timeoutMs) {
  return runEngine(
    bin,
    [
      '--page-size', format,
      '--margin-top', '12mm',
      '--margin-bottom', '12mm',
      '--margin-left', '12mm',
      '--margin-right', '12mm',
      '--encoding', 'utf-8',
      '--enable-local-file-access',
      htmlPath,
      pdfPath,
    ],
    pdfPath,
    timeoutMs
  );
}

function runWeasy(bin, htmlPath, pdfPath, timeoutMs) {
  return runEngine(bin, [htmlPath, pdfPath], pdfPath, timeoutMs);
}

function countPages(pdfPath) {
  try {
    const buf = fs.readFileSync(pdfPath).toString('latin1');
    const typePages = buf.match(/\/Type\s*\/Page[^s]/g);
    if (typePages && typePages.length) return typePages.length;
    const counts = Array.from(buf.matchAll(/\/Count\s+(\d+)/g)).map((m) => parseInt(m[1], 10));
    if (counts.length) return Math.max.apply(null, counts);
  } catch (_) {
    /* page count is advisory only */
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { format: 'Letter', engine: 'auto', htmlOnly: false, json: false, timeout: DEFAULT_TIMEOUT_MS };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') opts.out = argv[++i];
    else if (a === '--css') opts.css = argv[++i];
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--engine') opts.engine = argv[++i];
    else if (a === '--timeout') opts.timeout = parseInt(argv[++i], 10) || DEFAULT_TIMEOUT_MS;
    else if (a === '--html-only') opts.htmlOnly = true;
    else if (a === '--json') opts.json = true;
    else rest.push(a);
  }
  opts.input = rest[0];
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.input) {
    process.stderr.write('usage: node md-to-pdf.js <resume.md> [-o out.pdf] [--format Letter|A4]\n');
    process.exit(2);
  }
  if (!fs.existsSync(opts.input)) {
    process.stderr.write(`error: input not found: ${opts.input}\n`);
    process.exit(2);
  }
  if (!/^(Letter|A4)$/i.test(opts.format)) {
    process.stderr.write(`error: --format must be Letter or A4 (got ${opts.format})\n`);
    process.exit(2);
  }
  opts.format = opts.format.toLowerCase() === 'a4' ? 'A4' : 'Letter';

  const md = fs.readFileSync(opts.input, 'utf8');
  const cssPath = opts.css || path.join(__dirname, '..', 'assets', 'resume.css');
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  const outPdf = path.resolve(opts.out || opts.input.replace(/\.md$/i, '') + '.pdf');
  const outHtml = outPdf.replace(/\.pdf$/i, '.html');

  fs.mkdirSync(path.dirname(outPdf), { recursive: true });
  fs.writeFileSync(outHtml, buildHtml(md, css, opts.format), 'utf8');

  const report = { input: path.resolve(opts.input), html: outHtml, format: opts.format };

  if (opts.htmlOnly) {
    report.engine = 'none (--html-only)';
    process.stdout.write(opts.json ? JSON.stringify(report, null, 2) + '\n' : `HTML written: ${outHtml}\n`);
    return;
  }

  try {
    fs.rmSync(outPdf, { force: true });
  } catch (_) {
    /* stale output removal is best effort */
  }

  const wanted = opts.engine;
  const chrome = wanted === 'auto' || wanted === 'chrome' ? findChrome() : null;
  const wk = wanted === 'auto' || wanted === 'wkhtmltopdf' ? which('wkhtmltopdf') : null;
  const weasy = wanted === 'auto' || wanted === 'weasyprint' ? which('weasyprint') : null;

  let used = null;
  let res = null;
  if (chrome) {
    used = 'chrome';
    res = await runChrome(chrome, outHtml, outPdf, opts.timeout);
  } else if (wk) {
    used = 'wkhtmltopdf';
    res = await runWkhtml(wk, outHtml, outPdf, opts.format, opts.timeout);
  } else if (weasy) {
    used = 'weasyprint';
    res = await runWeasy(weasy, outHtml, outPdf, opts.timeout);
  }

  if (!used) {
    process.stderr.write(
      'error: no PDF rendering engine found (looked for Chrome/Chromium/Edge, wkhtmltopdf, weasyprint).\n' +
        `The formatted HTML is ready at ${outHtml} — open it in a browser and print to PDF.\n`
    );
    process.exit(3);
  }

  if (!fs.existsSync(outPdf) || fs.statSync(outPdf).size < 1000) {
    const detail = res && res.detail ? res.detail : '';
    process.stderr.write(`error: ${used} did not produce a valid PDF. ${detail}\n`);
    process.exit(4);
  }

  report.engine = used;
  report.pdf = outPdf;
  report.bytes = fs.statSync(outPdf).size;
  report.pages = countPages(outPdf);

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    const pageNote = report.pages ? `${report.pages} page(s)` : 'page count unknown';
    process.stdout.write(`PDF written: ${outPdf} (${used}, ${pageNote}, ${report.bytes} bytes)\n`);
    if (report.pages > 1) {
      process.stdout.write(
        'warning: output is longer than one page. Trim bullets or tighten the summary, then re-run.\n'
      );
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(4);
  });
}

module.exports = { renderBody, buildHtml, countPages, findChrome, runEngine };
