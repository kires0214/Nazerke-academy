import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.env.SMOKE_BASE_URL;
assert(base,'Set SMOKE_BASE_URL to the exact DEV or PROD origin');
const origin=new URL(base).origin;
for(const route of ['/','/about','/articles','/articles/kenwood','/events','/contacts','/privacy','/terms','/login']) {
  const response=await fetch(origin+route,{redirect:'manual'});assert.equal(response.status,200,route);
  assert(response.headers.get('x-content-type-options')==='nosniff');const html=await response.text();assert.equal((html.match(/<header/g)??[]).length,1,route+' single header');
}
for(const route of ['/academy','/admin']) {const response=await fetch(origin+route,{redirect:'manual'});assert([303,307].includes(response.status),route);assert.match(response.headers.get('location'),/\/login$/);}
assert.equal((await fetch(origin+'/api/profile')).status,401);
assert.equal((await fetch(origin+'/preview')).status,404);
const manifest=JSON.parse(await readFile(new URL('../legacy-demo/asset-manifest.json',import.meta.url),'utf8'));
for(const asset of manifest.assets) {
  const response=await fetch(origin+'/assets/'+asset.name);assert.equal(response.status,200,asset.name);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,asset.size);assert.equal(createHash('sha1').update(bytes).digest('hex'),asset.sha1);
}
console.log('PASS: 9 public pages; academy/Studio guest denial; no preview switcher; all 25 HTTP assets match baseline');
console.log('LIMIT: authenticated live provider flows require separate credentialed DEV/PROD smoke.');
