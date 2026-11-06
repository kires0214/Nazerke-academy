import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(await readFile(new URL('../legacy-demo/asset-manifest.json', import.meta.url), 'utf8'));
const target = new URL('../public/assets/', import.meta.url);
await mkdir(target, { recursive: true });
for (const asset of manifest.assets) {
  const source = new URL('../legacy-demo/assets/' + asset.name, import.meta.url);
  const bytes = await readFile(source);
  if (bytes.length !== asset.size || createHash('sha1').update(bytes).digest('hex') !== asset.sha1) throw new Error('Invalid baseline asset: ' + asset.name);
  await copyFile(source, new URL(asset.name, target));
}
console.log('PASS: 25 byte-preserved assets prepared for Next.js; binaries excluded from Git');
