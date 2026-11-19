import { cp, mkdir, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const destination = new URL('public/mediapipe/', root);
const source = new URL('node_modules/@mediapipe/tasks-vision/wasm/', root);
await mkdir(destination, { recursive: true });
for (const file of await readdir(source)) await cp(new URL(file, source), new URL(file, destination));
