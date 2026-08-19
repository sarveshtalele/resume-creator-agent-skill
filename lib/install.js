'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SKILL_NAME = 'resume-architect';

function packageRoot() {
  return path.resolve(__dirname, '..');
}

function sourceDir() {
  return path.join(packageRoot(), 'skills', SKILL_NAME);
}

/**
 * Resolve the directory the skill should be copied into.
 * global -> <home>/.claude/skills/<skill>
 * dir    -> <dir>/.claude/skills/<skill> (or <dir>/<skill> when dir already ends in skills)
 */
function resolveTarget(opts) {
  if (opts.dir) {
    const base = path.resolve(opts.dir);
    const inSkillsDir = path.basename(base) === 'skills';
    return inSkillsDir ? path.join(base, SKILL_NAME) : path.join(base, '.claude', 'skills', SKILL_NAME);
  }
  const root = opts.global ? os.homedir() : process.cwd();
  return path.join(root, '.claude', 'skills', SKILL_NAME);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.DS_Store') continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(src, dst);
    } else {
      fs.copyFileSync(src, dst);
      count++;
    }
  }
  return count;
}

function install(opts) {
  const src = sourceDir();
  if (!fs.existsSync(src)) {
    throw new Error(`packaged skill not found at ${src}`);
  }
  const dest = resolveTarget(opts);

  if (fs.existsSync(dest) && !opts.force) {
    return { status: 'exists', dest, files: 0 };
  }
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  const files = copyDir(src, dest);
  return { status: 'installed', dest, files };
}

function uninstall(opts) {
  const dest = resolveTarget(opts);
  if (!fs.existsSync(dest)) return { status: 'absent', dest };
  fs.rmSync(dest, { recursive: true, force: true });
  return { status: 'uninstalled', dest };
}

function listLocations() {
  return [
    { scope: 'project', path: resolveTarget({}) },
    { scope: 'global', path: resolveTarget({ global: true }) },
  ].map((loc) => Object.assign(loc, { installed: fs.existsSync(loc.path) }));
}

module.exports = { SKILL_NAME, install, uninstall, listLocations, resolveTarget, sourceDir, packageRoot };
