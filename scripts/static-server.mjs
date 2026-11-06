import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../legacy-demo/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.avif':'image/avif','.json':'application/json'};
const port=Number(process.env.PORT||3000);
const srv=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return}
    const data=await fs.readFile(f);
    res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(data);
  }catch{res.writeHead(404).end('Not found')}
});
srv.listen(port,'127.0.0.1',()=>console.log('JUICY static DEV at http://localhost:'+port));
