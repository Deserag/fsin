import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const source=new URL(process.env.DATABASE_URL),target=new URL(source);
target.pathname=`/fsin_verify_e2e_${Date.now()}`;
const bin=process.env.PG_BIN??'C:/Program Files/PostgreSQL/17/bin';
const createdb=process.platform==='win32'?`${bin}/createdb.exe`:'createdb';
const env={...process.env,PGHOST:source.hostname,PGPORT:source.port||'5432',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),DATABASE_URL:target.toString(),NODE_ENV:'test',JWT_SECRET:'verification-secret-only'};
const created=spawnSync(createdb,[target.pathname.slice(1)],{env,stdio:'inherit'});if(created.status!==0)process.exit(created.status??1);
mkdirSync('.verification',{recursive:true});writeFileSync('.verification/latest-e2e.json',JSON.stringify({url:target.toString()}));
for(const args of [['node_modules/@nestjs/cli/bin/nest.js','build'],['node_modules/prisma/build/index.js','migrate','deploy'],['node_modules/tsx/dist/cli.mjs','prisma/seed.ts'],['node_modules/vitest/vitest.mjs','run','--config','vitest.config.e2e.ts']]){const r=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);}
console.log('Test DB retained for inspection:',target.pathname.slice(1));
