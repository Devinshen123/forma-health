// Ephemeral, synthetic CI service. Never uses workspace data or an AI provider.
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app';
const directory = mkdtempSync(join(tmpdir(),'forma-ios-live-'));
const service = createApp({dataDir:directory,secureCookies:false,ai:{}});
const server = service.app.listen(3001,'127.0.0.1',()=>process.stdout.write('Synthetic iOS API ready\n'));
function stop(){server.close(()=>{service.close();process.exit(0);});}
process.on('SIGTERM',stop);
process.on('SIGINT',stop);
