// Ephemeral, synthetic CI service. Never uses workspace data or an AI provider.
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createApp} from '../server/app';
const directory = mkdtempSync(join(tmpdir(),'forma-ios-live-'));
const service = createApp({dataDir:directory,secureCookies:false,ai:{}});
const server = service.app.listen(3001,'127.0.0.1',()=>process.stdout.write('Synthetic iOS API ready\n'));
// A real HTTP document gives WebKit an actual origin and hash navigation. No vendor UI,
// private data, AI or licensed exercise media is used by the storage tests.
const fixture = createServer((request,response)=>{
  if(request.method!=='GET'||!request.url?.startsWith('/training-workbench/')){
    response.writeHead(404);response.end();return;
  }
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  response.end('<!doctype html><html><head><meta charset="utf-8"><title>Synthetic training fixture</title></head><body>Synthetic WebKit storage test</body></html>');
}).listen(3002,'127.0.0.1',()=>process.stdout.write('Synthetic WebKit fixture ready\n'));
function stop(){fixture.close(()=>server.close(()=>{service.close();process.exit(0);}));}
process.on('SIGTERM',stop);
process.on('SIGINT',stop);
