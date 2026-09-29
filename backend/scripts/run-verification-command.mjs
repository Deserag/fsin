import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const [target,command,...args]=process.argv.slice(2),targets=JSON.parse(readFileSync('.verification/targets.json','utf8'));
if(!['upgrade','clean'].includes(target)||!new URL(targets[target]).pathname.startsWith('/fsin_verify_'))throw new Error('Verification DB required');
const env={...process.env,DATABASE_URL:targets[target],NODE_ENV:'test',JWT_EXPIRES_IN:process.env.VERIFY_ACCESS_LIFETIME??'15m',JWT_SECRET:'verification-secret-only',PORT:'3101',CLIENT_ORIGIN:'http://localhost:4201'};
const commands={migrate:['node_modules/prisma/build/index.js','migrate','deploy'],generate:['node_modules/prisma/build/index.js','generate'],data:['node_modules/tsx/dist/cli.mjs','prisma/data-update.ts'],seed:['node_modules/tsx/dist/cli.mjs','prisma/seed.ts'],test:['node_modules/vitest/vitest.mjs','run','--config','vitest.config.e2e.ts'],serve:['dist/main.js']};
if(!commands[command])throw new Error('Unknown verification command');
const r=spawnSync(process.execPath,[...commands[command],...args],{env,stdio:'inherit'});process.exitCode=r.status??1;
