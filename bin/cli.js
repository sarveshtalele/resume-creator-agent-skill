#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { install, uninstall, listLocations, SKILL_NAME, packageRoot } = require('../lib/install');

const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot(), 'package.json'), 'utf8'));

const HELP = `
resume-creator-agent-skill v${pkg.version}
Installs the "${SKILL_NAME}" agent skill: an interview-driven, ATS-safe, one-page
resume builder that outputs Markdown first and PDF after approval.

Usage
  npx github:sarveshtalele/resume-creator-agent-skill [command] [options]

Commands
  install            Copy the skill into a skills directory (default command)
  uninstall          Remove a previously installed copy
  list               Show project and global install locations
  where              Print the packaged skill source path

Options
  -g, --global       Install for every project, under the home directory
  -d, --dir <path>   Install into a specific project root or skills directory
  -f, --force        Overwrite an existing installation in place
  -h, --help         Show this help
  -v, --version      Show the package version

Examples
  npx github:sarveshtalele/resume-creator-agent-skill                 # install into ./.claude/skills
  npx github:sarveshtalele/resume-creator-agent-skill install -g      # install for all projects
  npx github:sarveshtalele/resume-creator-agent-skill install -d ~/work/app
  npx github:sarveshtalele/resume-creator-agent-skill uninstall -g
`;

function parseArgs(argv) {
  const opts = { command: null, global: false, force: false, dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-g' || a === '--global') opts.global = true;
    else if (a === '-f' || a === '--force') opts.force = true;
    else if (a === '-d' || a === '--dir') opts.dir = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else if (!opts.command && !a.startsWith('-')) opts.command = a;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  if (opts.version) {
    process.stdout.write(pkg.version + '\n');
    return;
  }

  const command = opts.command || 'install';

  try {
    if (command === 'install') {
      const res = install(opts);
      if (res.status === 'exists') {
        process.stdout.write(
          `Already installed at ${res.dest}\n` + 'Re-run with --force to replace it with this version.\n'
        );
        return;
      }
      const scope = opts.dir ? 'custom' : opts.global ? 'global' : 'project';
      process.stdout.write(
        `Installed ${SKILL_NAME} (${res.files} files, ${scope} scope)\n` +
          `  ${res.dest}\n\n` +
          'Start a new agent session, then say:\n' +
          '  "Create a resume based on this job description: <paste posting>"\n' +
          '  and attach your exported LinkedIn profile PDF.\n'
      );
      return;
    }

    if (command === 'uninstall') {
      const res = uninstall(opts);
      process.stdout.write(
        res.status === 'absent' ? `Nothing installed at ${res.dest}\n` : `Removed ${res.dest}\n`
      );
      return;
    }

    if (command === 'list') {
      listLocations().forEach((loc) => {
        process.stdout.write(`${loc.installed ? 'installed' : '  absent '}  ${loc.scope.padEnd(8)}  ${loc.path}\n`);
      });
      return;
    }

    if (command === 'where') {
      process.stdout.write(path.join(packageRoot(), 'skills', SKILL_NAME) + '\n');
      return;
    }

    process.stderr.write(`Unknown command: ${command}\n${HELP}`);
    process.exit(2);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
