#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const scriptPath = path.join(__dirname, 'build', 'index.mjs');
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [scriptPath, ...args], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
