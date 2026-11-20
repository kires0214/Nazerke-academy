import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PublicShell,AcademyShell,StudioShell} from '../src/components/shells';
import {RichText} from '../src/components/cards';
import {VideoPlayer} from '../src/components/video-player';
import {EventCalendar} from '../src/components/event-calendar';
import {bodySchema} from '../src/lib/content';
import {eventTimeFromInput,localEventTime} from '../src/lib/event-time';
import {syntheticPrincipal} from './helpers';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
test('public, academy and Studio shells each have one header; student has one profile and no Studio link',()=>{
  const publicHtml=renderToStaticMarkup(createElement(PublicShell,{children:'Public'}));
  const academy=renderToStaticMarkup(createElement(AcademyShell,{user:syntheticPrincipal('student'),children:'Academy'}));
  const studio=renderToStaticMarkup(createElement(StudioShell,{user:syntheticPrincipal('techadmin'),children:'Studio'}));
  for(const html of [publicHtml,academy,studio])assert.equal((html.match(/<header/g)??[]).length,1);
  for(const html of [academy,studio])assert.equal((html.match(/>Выйти<\/button>/g)??[]).length,1);
  assert.doesNotMatch(publicHtml,/>Выйти<\/button>/);
  assert.match(publicHtml,/<a[^>]+href="\/login"[^>]*>Войти<\/a>/);
  assert.doesNotMatch(publicHtml,/Вы вошли/);
  const signedIn=renderToStaticMarkup(createElement(PublicShell,{user:{status:'approved'},children:'Public'}));
  assert.match(signedIn,/Вы вошли/);
  assert.match(signedIn,/<a[^>]+href="\/academy"[^>]*>В Академию<\/a>/);
  assert.doesNotMatch(signedIn,/<a[^>]+href="\/login"[^>]*>Войти<\/a>/);
  assert.equal((academy.match(/aria-label="Мой профиль"/g)??[]).length,1);assert.equal(academy.includes('href="/admin'),false);
  assert.equal(academy.includes('by Nazerke'),false);assert.match(academy,/Мобильная навигация/);
  assert.equal(publicHtml.includes('JUICY Studio'),false);
  for(const role of ['admin','techadmin'] as const){
    const staffAcademy=renderToStaticMarkup(createElement(AcademyShell,{user:syntheticPrincipal(role),children:'Academy'}));
    assert.match(staffAcademy,/<a[^>]+href="\/admin"[^>]*>Studio<\/a>/);
  }
});
test('rich content escapes stored XSS rather than executing HTML',()=>{
  const html=renderToStaticMarkup(createElement(RichText,{text:'<script>alert(1)</script>\n\n## A heading'}));assert.equal(html.includes('<script>'),false);assert.match(html,/&lt;script&gt;/);assert.match(html,/<h2>A heading/);
});
test('private player renders no playback URL/token or iframe before server authorization',()=>{
  const html=renderToStaticMarkup(createElement(VideoPlayer,{mediaId:'00000000-0000-4000-8000-000000000001'}));
  assert.match(html,/<video/);assert.equal(html.includes('<iframe'),false);assert.equal(html.includes('stream.mux.com'),false);assert.equal(html.includes('token='),false);assert.equal(html.includes('MUX_'),false);assert.match(html,/Смотреть видео/);
});
test('calendar uses the local day, shows booking details, and routes guests through login',()=>{
  const value='2027-06-01T00:30';
  const startsAt=eventTimeFromInput(value);
  assert.equal(localEventTime(startsAt),value);
  assert.ok(startsAt.startsWith('2027-05-31')); // UTC is still in the previous month.
  const node={id:'synthetic-event',kind:'event',title:'Синтетическая встреча',slug:'synthetic-event',description:'',
    language:'RU',audience:'public',status:'published' as const,parent_id:null,sort_order:0,cover:null,version:1,published_at:null,
    data:bodySchema.parse({startsAt,city:'Синтетический город',venueAddress:'Проверочный адрес',capacity:4})};
  const html=renderToStaticMarkup(createElement(EventCalendar,{items:[{node,remaining:3}],month:'2027-06',base:'/events',canOpenDetails:false}));
  assert.match(html,/meetings-2027-06-01/);
  assert.match(html,/Проверочный адрес/);
  assert.match(html,/Свободно мест: 3 из 4/);
  assert.match(html,/href="\/login"/);
  assert.match(html,/\?month=2027-07/);
});
test('25 original assets decode; four portraits are independent full images',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../legacy-demo/asset-manifest.json',import.meta.url),'utf8'));
  const portraits=[];
  for(const asset of manifest.assets) {const bytes=await readFile(new URL('../legacy-demo/assets/'+asset.name,import.meta.url));const info=await sharp(bytes).metadata();assert.ok(info.width&&info.height);assert.ok(info.width!>=200&&info.height!>=150);if(asset.kind==='owner_photo'){portraits.push(asset.sha1);assert.ok(info.width!>=600&&info.height!>=600);}}
  assert.equal(new Set(portraits).size,4);
});
