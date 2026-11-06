import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PublicShell,AcademyShell,StudioShell} from '../src/components/shells';
import {RichText} from '../src/components/cards';
import {syntheticPrincipal} from './helpers';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
test('public, academy and Studio shells each have one header; student has one profile and no Studio link',()=>{
  const publicHtml=renderToStaticMarkup(createElement(PublicShell,{children:'Public'}));
  const academy=renderToStaticMarkup(createElement(AcademyShell,{user:syntheticPrincipal('student'),children:'Academy'}));
  const studio=renderToStaticMarkup(createElement(StudioShell,{user:syntheticPrincipal('techadmin'),children:'Studio'}));
  for(const html of [publicHtml,academy,studio])assert.equal((html.match(/<header/g)??[]).length,1);
  assert.equal((academy.match(/aria-label="Мой профиль"/g)??[]).length,1);assert.equal(academy.includes('href="/admin'),false);
  assert.equal(academy.includes('by Nazerke'),false);assert.match(academy,/Мобильная навигация/);
  assert.equal(publicHtml.includes('JUICY Studio'),false);
});
test('rich content escapes stored XSS rather than executing HTML',()=>{
  const html=renderToStaticMarkup(createElement(RichText,{text:'<script>alert(1)</script>\n\n## A heading'}));assert.equal(html.includes('<script>'),false);assert.match(html,/&lt;script&gt;/);assert.match(html,/<h2>A heading/);
});
test('25 original assets decode; four portraits are independent full images',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../legacy-demo/asset-manifest.json',import.meta.url),'utf8'));
  const portraits=[];
  for(const asset of manifest.assets) {const bytes=await readFile(new URL('../legacy-demo/assets/'+asset.name,import.meta.url));const info=await sharp(bytes).metadata();assert.ok(info.width&&info.height);assert.ok(info.width!>=200&&info.height!>=150);if(asset.kind==='owner_photo'){portraits.push(asset.sha1);assert.ok(info.width!>=600&&info.height!>=600);}}
  assert.equal(new Set(portraits).size,4);
});
