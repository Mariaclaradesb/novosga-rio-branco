import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(join(root, 'public/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
  const path = match[1].split(/[?#]/, 1)[0];
  if (path !== '/') await access(join(root, 'public', path));
}
await access(join(root, 'public/layout.css'));
await access(join(root, 'api/atendimento.js'));
JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
console.log('Frontend validado. Arquivos estaticos em public/; API Node em api/.');
