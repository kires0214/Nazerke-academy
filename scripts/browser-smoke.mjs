import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createConnection} from 'node:net';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=4317,origin=`http://127.0.0.1:${port}`;
const auditDir=new URL('../../qa-evidence/',import.meta.url);
await mkdir(auditDir,{recursive:true});
const ledger={owner:'CODEX_PRIMARY / issue #1',createdAt:new Date().toISOString(),resources:[],checks:[],cleanup:[]};
const taskShell=process.env.TASK_PWSH_PATH;
async function record(){await writeFile(new URL('runtime.json',auditDir),JSON.stringify(ledger,null,2));}
function nativeIdentity(pid) {
  if(process.platform!=='win32')return {pid};
  assert(taskShell,'Set TASK_PWSH_PATH to the current PowerShell 7 executable');
  const command=`$taskIdentity=Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue | Select-Object @{n='ProcessId';e={$_.Id}},@{n='CreationDate';e={$_.StartTime.ToUniversalTime().ToString('o')}},@{n='ExecutablePath';e={$_.Path}};ConvertTo-Json -InputObject $taskIdentity -Compress;exit 0`;
  return JSON.parse(execFileSync(taskShell,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true}).trim()||'null');
}
function nativeChildren(pid) {
  if(process.platform!=='win32')return [];
  const command=`$taskQueue=[Collections.Generic.Queue[int]]::new();$taskQueue.Enqueue(${Number(pid)});$taskOwned=@();$taskSnapshot=Get-Process;while($taskQueue.Count){$taskParent=$taskQueue.Dequeue();$taskFound=@($taskSnapshot|Where-Object {try{$_.Parent.Id -eq $taskParent}catch{$false}});foreach($taskChild in $taskFound){$taskOwned+=$taskChild|Select-Object @{n='ProcessId';e={$_.Id}},@{n='ParentProcessId';e={$_.Parent.Id}},@{n='CreationDate';e={$_.StartTime.ToUniversalTime().ToString('o')}},@{n='ExecutablePath';e={$_.Path}};$taskQueue.Enqueue([int]$taskChild.Id)}};ConvertTo-Json -InputObject @($taskOwned) -Compress`;
  return JSON.parse(execFileSync(taskShell,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true}).trim()||'[]');
}
function survivors(children){return children.filter(identity=>{const current=nativeIdentity(identity.ProcessId);return current&&(!current.CreationDate||current.CreationDate===identity.CreationDate);});}
async function portOpen(){return new Promise(resolve=>{const socket=createConnection({port,host:'127.0.0.1'});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>{socket.destroy();resolve(false);});});}
assert.equal(await portOpen(),false,'QA port is already owned; do not reuse or stop it');
if(process.platform==='win32') {
  assert(nativeIdentity(process.pid),'Native process identity API unavailable; no startup');
  assert(nativeChildren(process.pid).some(p=>p.ExecutablePath?.toLowerCase()===taskShell.toLowerCase()),'Child process inspection unavailable; no startup');
}
const next=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',APP_ENV:'DEV'},
});
let nextIdentity,server,context;let output='';next.stdout.on('data',b=>output+=b);next.stderr.on('data',b=>output+=b);
try {
  assert(next.pid,'No managed Next child handle');nextIdentity=nativeIdentity(next.pid);assert(nextIdentity,'Could not establish Next process identity');
  ledger.resources.push({kind:'Next server',identity:nextIdentity,pid:next.pid,args:next.spawnargs,port,shutdown:'retained ChildProcess.kill followed by exit event; verify port closed'});await record();
  let ready=false;for(let attempt=0;attempt<60;attempt++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert(ready,'Next did not become ready');
  execFileSync(process.execPath,['scripts/smoke.mjs'],{cwd:root,env:{...process.env,SMOKE_BASE_URL:origin},stdio:'pipe',windowsHide:true});ledger.checks.push('HTTP smoke PASS');
  if(!process.argv.includes('--http-only')) {
  const executablePath=process.env.EDGE_EXECUTABLE??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  server=await chromium.launchServer({executablePath,headless:true});
  const browserProcess=server.process(),identity=nativeIdentity(browserProcess.pid);assert(identity,'Could not establish browser identity');
  ledger.resources.push({kind:'task-only Edge browser',identity,pid:browserProcess.pid,args:browserProcess.spawnargs,shutdown:'context.close, browser.close, BrowserServer.close; verify native PID/start no longer exists'});await record();
  const browser=await chromium.connect(server.wsEndpoint());context=await browser.newContext();const page=await context.newPage();
  const tabSession=await context.newCDPSession(page),{targetInfo}=await tabSession.send('Target.getTargetInfo');
  ledger.resources.push({kind:'browser context and tab',owner:'CODEX_PRIMARY QA',browserContextId:targetInfo.browserContextId,targetId:targetInfo.targetId,shutdown:'context.close and BrowserServer.close'});await tabSession.detach();await record();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [375,430,768,1280]) {
    await page.setViewportSize({width,height:900});await page.goto(origin,{waitUntil:'networkidle'});
    assert.equal(await page.locator('header').count(),1);
    assert.equal(await page.locator('img').evaluateAll(async images=>{images.forEach(i=>i.loading='eager');await Promise.all(images.map(i=>i.decode()));return images.every(i=>i.complete&&i.naturalWidth>0);}),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
    await page.screenshot({path:fileURLToPath(new URL(`juicy-${width}.png`,auditDir)),fullPage:true});
    if(width<=780){await page.locator('.mobile-menu summary').click();await Promise.all([page.waitForURL('**/about'),page.locator('.mobile-menu a[href="/about"]').click()]);assert.equal(new URL(page.url()).pathname,'/about');}
    ledger.checks.push(`public browser ${width}px PASS`);
  }
  await page.goto(origin+'/login');assert.match(await page.locator('main').innerText(),/Вход скоро откроется|Продолжить с Telegram/);
  for(const width of [375,1280]) {await page.setViewportSize({width,height:900});await page.goto('https://nazerke-academy-demo.vercel.app/',{waitUntil:'networkidle'});await page.screenshot({path:fileURLToPath(new URL(`baseline-${width}.png`,auditDir)),fullPage:true});}
  assert.deepEqual(errors,[],'Browser page errors');ledger.checks.push('browser console PASS; baseline screenshots captured');
  await context.close();context=undefined;await browser.close();
  }
}catch(error) {ledger.error={name:error.name,message:error.message};throw error;}finally {
  const browserChildren=server?nativeChildren(server.process().pid):[],nextChildren=nativeChildren(next.pid);
  ledger.resources.push({kind:'owned child snapshots before shutdown',browserChildren,nextChildren});await record();
  if(context)await context.close();
  if(server){const pid=server.process().pid;await server.close();const current=nativeIdentity(pid),remaining=survivors(browserChildren);ledger.cleanup.push({kind:'browser',pid,exited:!current,remainingChildren:remaining});}
  if(next.exitCode===null){const identity=nativeIdentity(next.pid);assert(!identity||identity.CreationDate===nextIdentity?.CreationDate,'Server identity changed; preserve uncertain process');const done=once(next,'exit');next.kill('SIGTERM');await done;}
  const current=nativeIdentity(next.pid),remaining=survivors(nextChildren);const listening=await portOpen();ledger.cleanup.push({kind:'Next server',pid:next.pid,exited:!current,remainingChildren:remaining,portReleased:!listening});
  await writeFile(new URL('server.log',auditDir),output);await record();assert(!current&&!listening&&ledger.cleanup.every(x=>x.exited&&!x.remainingChildren?.length),'Owned resource cleanup failed');
}
console.log(JSON.stringify({checks:ledger.checks,cleanup:ledger.cleanup,evidence:fileURLToPath(auditDir)}));
