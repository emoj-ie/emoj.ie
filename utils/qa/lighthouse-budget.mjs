import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const budgets = [
  { file: 'index.html', maxBytes: 30000 },
  { file: 'style.css', maxBytes: 120000 },
  { file: 'generated-pages.js', maxBytes: 30000 },
  { file: 'home-app.mjs', maxBytes: 60000 },
  { file: 'home-utils.mjs', maxBytes: 20000 },
  { file: 'sw.js', maxBytes: 30000 },
];

const failures = [];
for (const budget of budgets) {
  const filePath = path.join(root, budget.file);
  const size = fs.statSync(filePath).size;
  if (size > budget.maxBytes) {
    failures.push(`${budget.file}: ${size} bytes > ${budget.maxBytes} bytes`);
  }
}

if (failures.length > 0) {
  console.error('Lighthouse proxy budget check failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Lighthouse proxy budgets passed.');
