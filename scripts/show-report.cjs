const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../artifacts/automation');
const latest = process.argv[2] || fs.readdirSync(root).filter((x) => fs.existsSync(path.join(root, x, 'report.md'))).sort().at(-1);
if (!latest) throw new Error('No automation report exists; run the tests first');
process.stdout.write(fs.readFileSync(path.join(root, latest, 'report.md'), 'utf8'));
