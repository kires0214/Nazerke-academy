import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest=JSON.parse(await fs.readFile(new URL('../legacy-demo/asset-manifest.json',import.meta.url),'utf8'));
const target=new URL('../legacy-demo/assets/',import.meta.url);
await fs.mkdir(target,{recursive:true});
const verifyOnly=process.argv.includes('--verify');
const base=manifest.source.replace(/\/$/,'');
let success=0,fail=[];
function good(bytes,asset){return bytes?.length===asset.size&&createHash('sha1').update(bytes).digest('hex')===asset.sha1}
async function one(asset){
  const dest=new URL(asset.name,target);
  let contents=null;
  try{contents=await fs.readFile(dest)}catch{}
  if(!good(contents,asset)){
    if(verifyOnly)throw new Error('local file missing or checksum mismatch');
    const res=await fetch(base+'/assets/'+encodeURIComponent(asset.name),{signal:AbortSignal.timeout(20000)});
    if(!res.ok)throw new Error('HTTP '+res.status);
    if(!(res.headers.get('content-type')||'').startsWith('image/'))throw new Error('unexpected media type');
    contents=Buffer.from(await res.arrayBuffer());
    if(!good(contents,asset))throw new Error('SHA1 / size mismatch');
    await fs.writeFile(dest,contents);
  }
  success++;
}
let index=0;
await Promise.all(Array.from({length:4},async()=>{while(index<manifest.assets.length){const asset=manifest.assets[index++];try{await one(asset)}catch(e){fail.push(asset.name+': '+e.message)}}}));
console.log('JUICY assets:',success+'/'+manifest.assets.length,verifyOnly?'verified':'downloaded/verified');
if(fail.length){console.error(fail.join('\n'));process.exitCode=1}
