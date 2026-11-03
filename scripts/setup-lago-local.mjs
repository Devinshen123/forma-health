// Open-source Lago only, isolated loopback sandbox. No payment processor or real collection.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),storage=path.resolve(source,'..');
const root=path.resolve(process.env.FORMA_SERVICES_DIR||path.join(storage,'services'),'lago');
if(process.platform==='win32'&&!root.toLowerCase().startsWith('d:'+path.sep))throw new Error('Use the D drive for this project service data.');
for(const name of ['','postgres','redis','storage'])fs.mkdirSync(path.join(root,name),{recursive:true,mode:0o700});
if(process.platform==='win32'){const user=execFileSync('whoami',[],{encoding:'utf8'}).trim();execFileSync('icacls',[root,'/inheritance:r','/grant:r',`${user}:(OI)(CI)F`,'SYSTEM:(OI)(CI)F','BUILTIN\\Administrators:(OI)(CI)F'],{stdio:'ignore'});}
const file=path.join(root,'private-state.json');
if(!fs.existsSync(file)&&fs.readdirSync(path.join(root,'postgres')).length)throw new Error('Existing billing data has no matching keys; restore configuration rather than reset.');
if(!fs.existsSync(file)){
 const pair=generateKeyPairSync('rsa',{modulusLength:3072});
 fs.writeFileSync(file,JSON.stringify({version:1,apiKey:randomBytes(32).toString('hex'),adminEmail:'forma-local-admin@example.test',adminPassword:randomBytes(32).toString('base64url'),databasePassword:randomBytes(32).toString('base64url'),redisPassword:randomBytes(32).toString('base64url'),secretKey:randomBytes(64).toString('hex'),encryptionPrimary:randomBytes(32).toString('hex'),encryptionDeterministic:randomBytes(32).toString('hex'),encryptionSalt:randomBytes(32).toString('hex'),privateKey:pair.privateKey.export({type:'pkcs1',format:'pem'}).toString(),publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString()},null,2),{mode:0o600,flag:'wx'});
}
const state=JSON.parse(fs.readFileSync(file,'utf8'));
if(!state.privateKey||!state.apiKey||!state.secretKey)throw new Error('Private billing state is incomplete.');
const apiUrl='http://127.0.0.1:3442',frontUrl='http://127.0.0.1:3443';
const environment={DATABASE_URL:`postgresql://lago:${state.databasePassword}@db:5432/forma_lago?search_path=public`,REDIS_URL:`redis://:${state.redisPassword}@redis:6379`,REDIS_PASSWORD:state.redisPassword,RAILS_ENV:'production',RAILS_LOG_TO_STDOUT:'true',SECRET_KEY_BASE:state.secretKey,LAGO_RSA_PRIVATE_KEY:Buffer.from(state.privateKey).toString('base64'),LAGO_ENCRYPTION_PRIMARY_KEY:state.encryptionPrimary,LAGO_ENCRYPTION_DETERMINISTIC_KEY:state.encryptionDeterministic,LAGO_ENCRYPTION_KEY_DERIVATION_SALT:state.encryptionSalt,LAGO_API_URL:apiUrl,LAGO_FRONT_URL:frontUrl,LAGO_DISABLE_SEGMENT:'true',LAGO_DISABLE_SIGNUP:'true',LAGO_DISABLE_PDF_GENERATION:'true',LAGO_WEBHOOK_ALLOW_PRIVATE_URLS:'true',LAGO_CREATE_ORG:'true',LAGO_ORG_USER_EMAIL:state.adminEmail,LAGO_ORG_USER_PASSWORD:state.adminPassword,LAGO_ORG_NAME:'Forma local sandbox',LAGO_ORG_API_KEY:state.apiKey,LAGO_USE_AWS_S3:'false',LAGO_LICENSE:'',WEB_CONCURRENCY:'0',RAILS_MAX_THREADS:'3'};
const bind=(name,target)=>({type:'bind',source:path.join(root,name),target});
const log={driver:'json-file',options:{'max-size':'10m','max-file':'2'}};
const health={test:['CMD-SHELL','curl -fsS http://localhost:3000/health >/dev/null || exit 1'],interval:'10s',timeout:'5s',start_period:'90s',retries:15};
const extra=process.platform==='linux'?{extra_hosts:['host.docker.internal:host-gateway']}:{};
const backend={image:'getlago/api:v1.56.0',restart:'unless-stopped',environment,volumes:[bind('storage','/app/storage')],logging:log,...extra};
const depends={db:{condition:'service_healthy'},redis:{condition:'service_healthy'}};
const compose={name:'forma-lago-local',services:{
 db:{image:'getlago/postgres-partman:15.0-alpine',restart:'unless-stopped',environment:{POSTGRES_USER:'lago',POSTGRES_PASSWORD:state.databasePassword,POSTGRES_DB:'forma_lago',PGDATA:'/data/postgres'},volumes:[bind('postgres','/data/postgres')],healthcheck:{test:['CMD-SHELL','pg_isready -U lago -d forma_lago'],interval:'5s',timeout:'3s',retries:20},logging:log},
 redis:{image:'redis:7-alpine',restart:'unless-stopped',environment:{REDIS_PASSWORD:state.redisPassword},command:['/bin/sh','-c','exec redis-server --requirepass "$$REDIS_PASSWORD" --appendonly yes'],volumes:[bind('redis','/data')],healthcheck:{test:['CMD-SHELL','REDISCLI_AUTH="$$REDIS_PASSWORD" redis-cli ping'],interval:'5s',timeout:'3s',retries:20},logging:log},
 api:{...backend,command:['./scripts/start.sh'],ports:['127.0.0.1:3442:3000'],depends_on:depends,healthcheck:health},
 worker:{...backend,command:['./scripts/start.worker.sh'],depends_on:{api:{condition:'service_healthy'}},environment:{...environment,LAGO_CREATE_ORG:'false'}},
 clock:{...backend,command:['./scripts/start.clock.sh'],depends_on:{api:{condition:'service_healthy'}},environment:{...environment,LAGO_CREATE_ORG:'false'}},
 front:{image:'getlago/front:v1.56.0',restart:'unless-stopped',read_only:true,tmpfs:['/tmp'],ports:['127.0.0.1:3443:8080'],environment:{API_URL:apiUrl,APP_ENV:'production',LAGO_FRONT_URL:frontUrl,LAGO_DISABLE_PDF_GENERATION:'true'},depends_on:{api:{condition:'service_healthy'}},logging:log},
}};
const composeFile=path.join(root,'compose.json');fs.writeFileSync(composeFile,JSON.stringify(compose,null,2),{mode:0o600});
if(process.argv.includes('--start')){
 const result=spawnSync('docker',['compose','-f',composeFile,'up','-d'],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Lago did not start; private configuration/data retained.');
 const until=Date.now()+60000;let ready=false;
 while(Date.now()<until){try{const response=await fetch(apiUrl+'/health',{signal:AbortSignal.timeout(3000)});if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw new Error('Open-source Lago is not healthy; inspect private logs.');
 const response=await fetch(apiUrl+'/api/v1/plans',{headers:{Authorization:`Bearer ${state.apiKey}`},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Lago API key bootstrap needs inspection; no credential was printed.');
}
console.log(JSON.stringify({configured:true,apiUrl,frontUrl,mode:'local-sandbox',openSource:true,realPaymentProviderConfigured:false,pdfGeneration:false,privateDirectory:root}));
