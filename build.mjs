import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'vite';
import { readTechniqueConfig } from './scripts/read-technique-config.mjs';

const normalize = text => text.replace(/\r\n/g, '\n');
const outputDirectory = new URL('./dist/server/', import.meta.url);
await build();
const assets = {
  '/project.txt': normalize(readFileSync(new URL('./docs/project.txt', import.meta.url), 'utf8')),
  '/config.json': readTechniqueConfig(),
};
const server = normalize(readFileSync(new URL('./server.mjs', import.meta.url), 'utf8'));
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(new URL('index.js', outputDirectory),
  `const assets=${JSON.stringify(assets)};\n${server}\nexport default createApp(assets);\n`);
console.log('Interfaz 3D: dist/client. MCP Worker: dist/server/index.js (requiere binding ASSETS para los archivos estáticos).');
