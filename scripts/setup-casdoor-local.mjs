// Local-only identity service. No production deployment, account import or data reset.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';

const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const services=path.resolve(process.env.FORMA_SERVICES_DIR||path.join(source,'..','services'));
const root=path.join(services,'casdoor'),stateFile=path.join(root,'private-state.json');
const issuer='http://127.0.0.1:3440',application='forma-web';
if(process.platform==='win32'&&!services.toLowerCase().startsWith('d:'+path.sep))throw new Error('Use a D-drive FORMA_SERVICES_DIR for this Windows project.');
for(const rel of ['','data','logs','sessions','mail'])fs.mkdirSync(path.join(root,rel),{recursive:true,mode:0o700});
if(process.platform==='win32'){
 const user=execFileSync('whoami',[],{encoding:'utf8'}).trim();
 execFileSync('icacls',[root,'/inheritance:r','/grant:r',`${user}:(OI)(CI)F`,'SYSTEM:(OI)(CI)F','BUILTIN\\Administrators:(OI)(CI)F'],{stdio:'ignore'});
}
if(!fs.existsSync(stateFile)&&fs.readdirSync(path.join(root,'data')).length)throw new Error('Existing identity data has no matching private state; restore configuration, never reset it.');
if(!fs.existsSync(stateFile))fs.writeFileSync(stateFile,JSON.stringify({version:1,adminPassword:randomBytes(32).toString('base64url'),clientId:randomBytes(16).toString('hex'),clientSecret:randomBytes(32).toString('base64url')},null,2),{mode:0o600,flag:'wx'});
const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
if(!state.adminPassword||!state.clientId||!state.clientSecret)throw new Error('Invalid private state; restore original file.');
const signupItems=[
 {name:'Username',visible:true,required:true,prompted:false},
 {name:'Display name',visible:true,required:true,prompted:false},
 {name:'Password',visible:true,required:true,prompted:false},
 {name:'Confirm password',visible:true,required:true,prompted:false},
 {name:'Email',visible:true,required:true,prompted:false,rule:'Normal'},
 {name:'Signup button',visible:true,required:false,prompted:false},
];
const initial={
 organizations:[{owner:'admin',name:'forma-local',displayName:'Forma',websiteUrl:'http://127.0.0.1:3001',passwordType:'bcrypt',passwordOptions:['AtLeast10'],countryCodes:['US','CN'],defaultApplication:application,defaultTokenFormat:'JWT-Standard',languages:['zh','en'],isProfilePublic:false}],
 providers:[{owner:'admin',name:'forma-local-mail',displayName:'Local test mailbox',category:'Email',type:'Default',host:'mailpit',port:1025,clientId:'',clientSecret:'',clientId2:'no-reply@forma.test',clientSecret2:'Forma test',sslMode:'Disable',enableProxy:false,title:'Forma local verification',content:'Your Forma local verification code is %s. This email stays in the local test mailbox.'}],
 applications:[{owner:'admin',name:application,displayName:'Forma',homepageUrl:'http://127.0.0.1:3001',organization:'forma-local',cert:'cert-forma-local',enablePassword:true,enableSignUp:true,enableSigninSession:true,clientId:state.clientId,clientSecret:state.clientSecret,providers:[{name:'forma-local-mail',rule:'All',canSignUp:false,canSignIn:false,canUnlink:false}],signinMethods:[{name:'Password',displayName:'Password',rule:'All'}],signupItems,grantTypes:['authorization_code'],redirectUris:['http://127.0.0.1:3001/auth/callback/casdoor','http://127.0.0.1:3009/auth/callback/casdoor'],tokenFormat:'JWT-Standard',tokenFields:[],expireInHours:1,isShared:false,failedSigninLimit:5,failedSigninFrozenTime:15}],
 certs:[{owner:'admin',name:'cert-forma-local',displayName:'Forma local signing',scope:'JWT',type:'x509',cryptoAlgorithm:'RS256',bitSize:4096,expireInYears:1}],
};
fs.writeFileSync(path.join(root,'init-data.json'),JSON.stringify(initial,null,2),{mode:0o600});
const config={appname:'casdoor',httpport:8000,runmode:'prod',copyrequestbody:true,driverName:'sqlite',dataSourceName:'file:/data/casdoor.db?cache=shared',dbName:'casdoor',showSql:false,origin:issuer,originFrontend:issuer,isDemoMode:false,initAdminPassword:state.adminPassword,initDataNewOnly:true,initDataWatchInterval:0,initDataFile:'/init-data.json',defaultApplication:application,defaultLanguage:'zh',showGithubCorner:false,enableErrorMask:true,socks5Proxy:'',frontendBaseDir:'./web',logPostOnly:true,logConfig:JSON.stringify({adapter:'file',filename:'/logs/casdoor.log',maxdays:7,perm:'0700'})};
fs.writeFileSync(path.join(root,'app.conf'),Object.entries(config).map(([k,v])=>`${k} = ${k==='logConfig'?v:typeof v==='string'?JSON.stringify(v):v}`).join('\n')+'\n',{mode:0o600});
const bind=(from,to,readOnly=false)=>({type:'bind',source:path.join(root,from),target:to,read_only:readOnly});
const compose={name:'forma-casdoor-local',services:{
 casdoor:{image:'casbin/casdoor:v4.25.0',restart:'unless-stopped',ports:['127.0.0.1:3440:8000'],volumes:[bind('data','/data'),bind('logs','/logs'),bind('sessions','/tmp'),bind('app.conf','/conf/app.conf',true),bind('init-data.json','/init-data.json',true)],depends_on:['mailpit'],logging:{driver:'json-file',options:{'max-size':'5m','max-file':'2'}}},
 mailpit:{image:'axllent/mailpit:v1.33.0',restart:'unless-stopped',ports:['127.0.0.1:3441:8025'],environment:{MP_DATABASE:'/data/mailpit.db',MP_MAX_MESSAGES:'100'},volumes:[bind('mail','/data')],logging:{driver:'json-file',options:{'max-size':'5m','max-file':'2'}}},
}};
const composeFile=path.join(root,'compose.json');fs.writeFileSync(composeFile,JSON.stringify(compose,null,2),{mode:0o600});
if(process.argv.includes('--write-env')){
 const envFile=path.join(source,'.env'),start='# BEGIN FORMA LOCAL CASDOOR',end='# END FORMA LOCAL CASDOOR';
 if(!fs.existsSync(envFile))throw new Error('Existing private Forma .env is required; do not replace it.');
 const original=fs.readFileSync(envFile,'utf8'),block=[start,`FORMA_AUTH_CASDOOR_ISSUER=${issuer}`,`FORMA_AUTH_CASDOOR_APPLICATION=${application}`,`FORMA_AUTH_CASDOOR_CLIENT_ID=${state.clientId}`,`FORMA_AUTH_CASDOOR_CLIENT_SECRET=${state.clientSecret}`,end].join('\n');
 const begin=original.indexOf(start),finish=original.indexOf(end);
 if(begin>=0&&finish>=begin)fs.writeFileSync(envFile,original.slice(0,begin)+block+original.slice(finish+end.length),{mode:0o600});
 else{if(/^FORMA_AUTH_CASDOOR_.*=/m.test(original))throw new Error('Unmanaged Casdoor config already exists; preserve it and configure explicitly.');fs.appendFileSync(envFile,'\n'+block+'\n',{mode:0o600});}
}
if(process.argv.includes('--start')){
 const result=spawnSync('docker',['compose','-f',composeFile,'up','-d'],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Local identity service did not start; files and data preserved.');
 const until=Date.now()+90000;let ready=false;
 while(Date.now()<until){try{const r=await fetch(issuer+'/api/health',{signal:AbortSignal.timeout(3000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw new Error('Local identity service not ready; inspect private logs without printing credentials.');
 const discovery=await(await fetch(issuer+`/.well-known/${application}/openid-configuration`)).json();
 if(discovery.issuer!==issuer||discovery.jwks_uri!==issuer+`/.well-known/${application}/jwks`)throw new Error('Unexpected local OIDC discovery identity.');
}
console.log(JSON.stringify({configured:true,issuer,application,testMailbox:'http://127.0.0.1:3441',servicesDirectory:root,privateConfigWritten:process.argv.includes('--write-env'),realEmailDelivery:false,sharedExistingData:false}));
