// Defense in depth: print filenames/rule names only, never matched secret values.
const fs = require('node:fs');
const path = require('node:path');
const { readAssessmentReadme } = require('../helpers/shared.cjs');
const root = path.resolve(__dirname, '../artifacts/automation');
const args = process.argv.slice(2);
const prefix = args[0] === '--ci-prefix' ? args[1] : undefined;
if (args.length && (args.length !== 2 || !prefix || !/^ci-[A-Za-z0-9_-]{1,80}$/.test(prefix))) {
  console.error('Artifact audit: expected --ci-prefix ci-<safe-run-id>'); process.exit(1);
}
const readme = process.env.QA_README_PATH || path.resolve(__dirname, '../../virtual-data-room/README.md');
const passwords = [process.env.QA_OWNER_PASSWORD, process.env.QA_VIEWER_PASSWORD, process.env.QA_STORAGE_UPLOAD_KEY].filter(Boolean);
if (fs.existsSync(readme)) passwords.push(...readAssessmentReadme(readme).accounts.map((a) => a.password));
const issues = [];
let textFiles = 0, images = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) { issues.push({ file: path.relative(root, file), rule: 'symlink is not an approved artifact' }); continue; }
    if (entry.isDirectory()) { visit(file); continue; }
    const relative = path.relative(root, file);
    if (/\.(png|jpe?g)$/i.test(entry.name)) { images++; continue; }
    if (/\.(zip|har|webm)$/i.test(entry.name) || entry.name === 'error-context.md') {
      issues.push({ file: relative, rule: 'forbidden raw diagnostic artifact' }); continue;
    }
    if (!/\.(json|md|txt|log)$/i.test(entry.name)) continue;
    textFiles++;
    const content = fs.readFileSync(file, 'utf8');
    if (passwords.some((secret) => content.includes(secret))) issues.push({ file: relative, rule: 'configured/documented credential literal' });
    if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(content)) issues.push({ file: relative, rule: 'JWT-shaped value' });
    if (/https?:[^\s"<>]+(?:[?&](?:token|signature|X-Amz-Signature)=|\/storage\/v1\/object\/(?:sign|upload\/sign)\/)/i.test(content)) issues.push({ file: relative, rule: 'signed URL' });
    if (/"(?:password|accessToken|token|uploadUrl|authorization|apikey|cookie)"\s*:\s*"(?!\[)[^"]+"/i.test(content)) issues.push({ file: relative, rule: 'unredacted sensitive field' });
  }
}
if (prefix) {
  const directories = ['stable', 'known'].map((phase) => path.join(root, `${prefix}-${phase}`)).filter((dir) => fs.existsSync(dir));
  if (!directories.length) issues.push({ rule: 'no current CI artifacts found' });
  for (const directory of directories) visit(directory);
} else if (fs.existsSync(root)) visit(root);
console.log(JSON.stringify({ textFiles, imagesRequiringVisualReview: images, issues }, null, 2));
console.log('Pattern scan is not proof of absence; screenshots require visual review.');
if (issues.length) process.exitCode = 1;
