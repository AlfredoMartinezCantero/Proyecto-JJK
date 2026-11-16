import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
const assets={};for(const f of readdirSync('web'))assets['/'+f]=readFileSync('web/'+f,'utf8');assets['/']=assets['/index.html'];
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js',`const assets=${JSON.stringify(assets)};\n`+readFileSync('server.mjs','utf8'));
