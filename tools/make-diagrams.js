#!/usr/bin/env node
/**
 * make-diagrams.js — regenerate the hand-drawn documentation diagrams.
 *
 *   npm run diagrams
 *
 * Every number in the charts comes from docs/token-measurements.json, which is
 * produced by tools/measure-tokens.js. Regenerate the measurements first if the
 * skill's content changes, so a chart can never drift from what it claims.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'assets');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'token-measurements.json'), 'utf8'));

const INK = '#2b2a28';
const PAPER = '#fdf8ef';
const TEAL = '#2e7d74';
const CORAL = '#d1603d';
const MUSTARD = '#dfa044';
const SLATE = '#5b6c82';
const FADE = '#9a938a';

const HAND = "'Comic Sans MS','Chalkboard SE','Segoe Print','Bradley Hand',cursive";

/* ---------- deterministic wobble ---------- */

let seed = 20260820;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const jitter = (amp) => (rnd() - 0.5) * amp;

function roughLine(x1, y1, x2, y2, opts = {}) {
  const { stroke = INK, width = 2, amp = 1.6, passes = 2, dash = null } = opts;
  const out = [];
  for (let p = 0; p < passes; p++) {
    const mx = (x1 + x2) / 2 + jitter(amp * 2.2);
    const my = (y1 + y2) / 2 + jitter(amp * 2.2);
    const d = `M ${x1 + jitter(amp)} ${y1 + jitter(amp)} Q ${mx} ${my} ${x2 + jitter(amp)} ${y2 + jitter(amp)}`;
    out.push(
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"` +
        `${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${p === 0 ? 1 : 0.55}"/>`
    );
  }
  return out.join('');
}

function roughRect(x, y, w, h, opts = {}) {
  return (
    roughLine(x, y, x + w, y, opts) +
    roughLine(x + w, y, x + w, y + h, opts) +
    roughLine(x + w, y + h, x, y + h, opts) +
    roughLine(x, y + h, x, y, opts)
  );
}

function hatch(x, y, w, h, color, gap = 7) {
  const out = [];
  for (let i = -h; i < w; i += gap) {
    const x1 = x + i;
    const y1 = y + h;
    const x2 = x + i + h;
    const y2 = y;
    const cx1 = Math.max(x, Math.min(x + w, x1));
    const cx2 = Math.max(x, Math.min(x + w, x2));
    const t1 = (cx1 - x1) / (x2 - x1 || 1);
    const t2 = (cx2 - x1) / (x2 - x1 || 1);
    out.push(
      roughLine(cx1, y1 + (y2 - y1) * t1, cx2, y1 + (y2 - y1) * t2, {
        stroke: color,
        width: 1.6,
        amp: 0.9,
        passes: 1,
      })
    );
  }
  return out.join('');
}

function bar(x, y, w, h, color, opts = {}) {
  const { ghost = false } = opts;
  if (ghost) return roughRect(x, y, w, h, { stroke: color, width: 2, amp: 1.4, dash: '9 6' });
  return `<g>${hatch(x, y, w, h, color, 7)}${roughRect(x, y, w, h, { stroke: color, width: 2.2, amp: 1.3 })}</g>`;
}

function text(x, y, s, opts = {}) {
  const { size = 15, fill = INK, anchor = 'start', weight = 'normal', family = HAND, rotate = 0 } = opts;
  const t = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${t}>${s}</text>`;
}

function frame(w, h, title, subtitle) {
  return {
    open:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">` +
      `<title>${title}</title><desc>${subtitle}</desc>` +
      `<defs><filter id="wob"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter></defs>` +
      `<rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="${PAPER}"/>` +
      roughRect(9, 9, w - 18, h - 18, { stroke: '#d9cfbe', width: 2, amp: 1.2 }) +
      `<g filter="url(#wob)">` +
      text(34, 46, title, { size: 22, weight: 'bold' }) +
      text(34, 68, subtitle, { size: 13, fill: FADE }),
    close: '</g></svg>',
  };
}

const fmt = (n) => n.toLocaleString('en-US');

/* ---------- 1. what enters the context window ---------- */

function contextLayers() {
  const w = 980;
  const h = 500;
  const f = frame(
    w,
    h,
    'What actually enters the context window',
    `Measured with o200k BPE. The bundle is ${fmt(M.layers.whole_bundle)} tokens; almost none of it is ever resident.`
  );
  const rows = [
    ['Always resident: the metadata line', M.layers.metadata_description_always_resident, TEAL, 'in context every session'],
    ['On trigger: SKILL.md', M.layers.skill_md_on_trigger, SLATE, 'read once per resume'],
    ['On demand: one reference file', Math.round((M.layers.one_reference_min + M.layers.one_reference_max) / 2), MUSTARD, `${fmt(M.layers.one_reference_min)}–${fmt(M.layers.one_reference_max)} each, rarely all five`],
    ['Per call: one validator verdict', M.verdicts.lint_pass_text, CORAL, 'the answer, not the reasoning'],
    ['Script source code', M.layers.scripts_never_loaded, FADE, 'executed, never read into context'],
  ];
  const x0 = 400;
  const maxW = 440;
  const max = M.layers.scripts_never_loaded;
  let y = 112;
  const body = rows
    .map(([label, value, color, note], i) => {
      const bw = Math.max(6, (value / max) * maxW);
      const g =
        text(x0 - 20, y + 12, label, { anchor: 'end', size: 14 }) +
        text(x0 - 20, y + 30, note, { anchor: 'end', size: 11.5, fill: FADE }) +
        bar(x0, y, bw, 26, color, { ghost: i === rows.length - 1 }) +
        text(x0 + bw + 12, y + 19, fmt(value), { size: 15, weight: 'bold', fill: color });
      y += 66;
      return g;
    })
    .join('');
  const foot =
    roughLine(60, y + 6, w - 60, y + 6, { stroke: '#ded3c2', width: 1.6, amp: 0.8 }) +
    text(w / 2, y + 36, `A whole run costs about ${fmt(M.derived.typicalRun)} tokens — ` +
      `${Math.round((1 - M.derived.typicalRun / M.layers.whole_bundle) * 100)}% less than reading the bundle.`,
      { size: 15, fill: INK, anchor: 'middle' });
  return f.open + body + foot + f.close;
}

/* ---------- 2. progressive disclosure vs inlining ---------- */

function disclosureVsInline() {
  const w = 940;
  const h = 470;
  const f = frame(
    w,
    h,
    'Why progressive disclosure, in tokens',
    'Same knowledge, two packaging choices. Only the trigger-time cost differs.'
  );
  const baseY = 380;
  const scale = 250 / M.derived.inlined;
  const cols = [
    { x: 150, label: 'Everything inlined', total: M.derived.inlined, parts: [['SKILL.md', M.layers.skill_md_on_trigger, SLATE], ['5 references', M.layers.all_references, MUSTARD]] },
    { x: 470, label: 'This skill', total: M.layers.skill_md_on_trigger, parts: [['SKILL.md', M.layers.skill_md_on_trigger, SLATE]] },
  ];
  let body = '';
  cols.forEach((c) => {
    let y = baseY;
    c.parts.forEach(([name, value, color]) => {
      const bh = value * scale;
      y -= bh;
      body += bar(c.x, y, 190, bh, color);
      body += text(c.x + 95, y + bh / 2 + 6, `${name}  ${fmt(value)}`, { anchor: 'middle', size: 13 });
    });
    body += text(c.x + 95, baseY + 28, c.label, { anchor: 'middle', size: 16, weight: 'bold' });
    body += text(c.x + 95, baseY + 50, `${fmt(c.total)} tokens on trigger`, { anchor: 'middle', size: 13, fill: FADE });
  });

  const pct = Math.round((1 - M.layers.skill_md_on_trigger / M.derived.inlined) * 100);
  body +=
    roughLine(360, 150, 455, 150, { stroke: CORAL, width: 2.4, amp: 1.4 }) +
    roughLine(455, 150, 444, 144, { stroke: CORAL, width: 2.4, amp: 1 }) +
    roughLine(455, 150, 444, 156, { stroke: CORAL, width: 2.4, amp: 1 }) +
    text(408, 138, `${pct}% lighter`, { anchor: 'middle', size: 16, weight: 'bold', fill: CORAL });

  body +=
    text(690, 170, 'The five reference files', { size: 14, weight: 'bold' }) +
    text(690, 192, 'are still there. They open', { size: 14 }) +
    text(690, 214, 'only when the phase that', { size: 14 }) +
    text(690, 236, 'needs them starts — usually', { size: 14 }) +
    text(690, 258, `one file, ${fmt(M.layers.one_reference_min)}–${fmt(M.layers.one_reference_max)} tokens.`, { size: 14 }) +
    roughRect(672, 146, 232, 130, { stroke: '#ded3c2', width: 1.8, amp: 1.2 });

  body += roughLine(120, baseY, 880, baseY, { stroke: INK, width: 2, amp: 1 });
  return f.open + body + f.close;
}

/* ---------- 3. the revision loop ---------- */

function revisionLoop() {
  const w = 940;
  const h = 470;
  const f = frame(
    w,
    h,
    'The revision loop is where skills leak tokens',
    `Every edit needs a fresh verdict. Reading a ${M.verdicts.lint_pass_text}-token verdict beats re-reading the document.`
  );
  const x0 = 130;
  const y0 = 360;
  const xEnd = 690;
  const yTop = 120;
  const cycles = 5;
  const perRead = M.verdicts.resume_document;
  const perVerdict = M.verdicts.lint_pass_text;
  const maxY = perRead * cycles;
  const px = (i) => x0 + (i / cycles) * (xEnd - x0);
  const py = (v) => y0 - (v / maxY) * (y0 - yTop);

  let body = roughLine(x0, y0, xEnd + 30, y0, { stroke: INK, width: 2, amp: 1 }) + roughLine(x0, y0, x0, yTop - 10, { stroke: INK, width: 2, amp: 1 });

  for (let i = 1; i <= cycles; i++) {
    body += text(px(i), y0 + 26, `edit ${i}`, { anchor: 'middle', size: 12.5, fill: FADE });
    body += roughLine(px(i), y0 - 4, px(i), y0 + 4, { stroke: INK, width: 1.6, amp: 0.6, passes: 1 });
  }
  [0, 1000, 2000].forEach((v) => {
    if (v <= maxY) {
      body += text(x0 - 12, py(v) + 5, fmt(v), { anchor: 'end', size: 12, fill: FADE });
      body += roughLine(x0 - 4, py(v), x0 + 4, py(v), { stroke: INK, width: 1.4, amp: 0.5, passes: 1 });
    }
  });

  const series = (per, color, label) => {
    let d = '';
    for (let i = 0; i < cycles; i++) {
      d += roughLine(px(i), py(per * i), px(i + 1), py(per * (i + 1)), { stroke: color, width: 3, amp: 1.4 });
    }
    for (let i = 1; i <= cycles; i++) {
      d += `<circle cx="${px(i)}" cy="${py(per * i)}" r="4.5" fill="${color}"/>`;
    }
    d += text(px(cycles) + 16, py(per * cycles) + 5, fmt(per * cycles), { size: 15, fill: color, weight: 'bold' });
    d += text(px(cycles) + 16, py(per * cycles) + 24, label, { size: 12.5, fill: color });
    return d;
  };

  body += series(perRead, CORAL, 're-read the resume');
  body += series(perVerdict, TEAL, 'read the verdict');

  body +=
    text(150, 150, `${fmt(perRead)} tokens`, { size: 14, fill: CORAL, weight: 'bold' }) +
    text(150, 172, 'per re-read of the document', { size: 13, fill: FADE }) +
    text(150, 206, `${fmt(perVerdict)} tokens`, { size: 14, fill: TEAL, weight: 'bold' }) +
    text(150, 228, 'per validator verdict, and it', { size: 13, fill: FADE }) +
    text(150, 248, 'also catches what a re-read', { size: 13, fill: FADE }) +
    text(150, 268, 'would have to reason out', { size: 13, fill: FADE });

  body += text(x0, y0 + 62, 'cumulative tokens spent checking the draft, over five revisions', { size: 13, fill: FADE });
  return f.open + body + f.close;
}

/* ---------- 4. the pipeline ---------- */

function pipeline() {
  const w = 1000;
  const h = 450;
  const f = frame(w, h, 'How a resume gets built', 'Six phases, two human gates, one Markdown source of truth.');

  const boxes = [
    ['Parse', 'posting + profile', 55, 110, TEAL],
    ['Interview', 'max 3 rounds', 245, 110, TEAL],
    ['Plan', 'plan.md', 435, 110, MUSTARD],
    ['Draft', 'resume.md', 625, 220, SLATE],
    ['Revise', 'validate each edit', 245, 330, SLATE],
    ['Render', 'resume.pdf', 800, 330, CORAL],
  ];
  let body = '';
  boxes.forEach(([title, sub, x, y, color]) => {
    body += bar(x, y, 150, 62, color);
    body += text(x + 75, y + 28, title, { anchor: 'middle', size: 17, weight: 'bold' });
    body += text(x + 75, y + 48, sub, { anchor: 'middle', size: 12, fill: INK });
  });

  const arrow = (x1, y1, x2, y2, color = INK) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    return (
      roughLine(x1, y1, x2, y2, { stroke: color, width: 2.2, amp: 1.2 }) +
      roughLine(x2, y2, x2 - 11 * Math.cos(a - 0.4), y2 - 11 * Math.sin(a - 0.4), { stroke: color, width: 2.2, amp: 0.7, passes: 1 }) +
      roughLine(x2, y2, x2 - 11 * Math.cos(a + 0.4), y2 - 11 * Math.sin(a + 0.4), { stroke: color, width: 2.2, amp: 0.7, passes: 1 })
    );
  };

  const gate = (x, y, label) =>
    bar(x, y, 130, 42, CORAL, { ghost: true }) +
    text(x + 65, y + 27, label, { anchor: 'middle', size: 14, weight: 'bold', fill: CORAL });

  // row 1: parse -> interview -> plan -> gate A
  body += arrow(207, 141, 241, 141);
  body += arrow(397, 141, 431, 141);
  body += arrow(587, 141, 631, 141);
  body += gate(635, 120, 'GATE A');
  body += text(700, 178, 'approve the plan', { anchor: 'middle', size: 11.5, fill: FADE });

  // gate A -> draft
  body += arrow(700, 190, 700, 216, CORAL);

  // draft -> revise
  body += arrow(621, 262, 401, 344);

  // self-loop on revise: every edit is re-validated before it is shown
  body +=
    `<path d="M 268 326 C 276 286, 364 286, 372 322" fill="none" stroke="${SLATE}" stroke-width="2.2"` +
    ` stroke-linecap="round" stroke-dasharray="7 5"/>` +
    roughLine(372, 322, 364, 310, { stroke: SLATE, width: 2.2, amp: 0.7, passes: 1 }) +
    roughLine(372, 322, 380, 310, { stroke: SLATE, width: 2.2, amp: 0.7, passes: 1 }) +
    text(320, 282, 'loop until approved', { anchor: 'middle', size: 12, fill: SLATE });

  // revise -> gate B -> render
  body += arrow(399, 361, 631, 361);
  body += gate(635, 340, 'GATE B');
  body += text(700, 398, 'approve the Markdown', { anchor: 'middle', size: 11.5, fill: FADE });
  body += arrow(769, 361, 796, 361, CORAL);

  return f.open + body + f.close;
}

/* ---------- write ---------- */

fs.mkdirSync(OUT, { recursive: true });
const files = {
  'context-layers.svg': contextLayers(),
  'disclosure-vs-inline.svg': disclosureVsInline(),
  'revision-loop.svg': revisionLoop(),
  'pipeline.svg': pipeline(),
};
Object.entries(files).forEach(([name, svg]) => {
  fs.writeFileSync(path.join(OUT, name), svg + '\n');
  process.stdout.write(`wrote docs/assets/${name} (${svg.length} bytes)\n`);
});
