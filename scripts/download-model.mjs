import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const model = new URL('public/models/hand_landmarker.task', root);
const modelURL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const expectedSHA256 = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(new URL('public/models/', root), { recursive: true });
let bytes = await readFile(model).catch(() => null);
if (!bytes || sha(bytes) !== expectedSHA256) {
  console.log('Descargando el modelo oficial de manos (sin enviar imágenes)…');
  const response = await fetch(modelURL, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`Modelo: HTTP ${response.status}. Reintenta con npm run setup:assets.`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (sha(bytes) !== expectedSHA256) throw new Error('El hash del modelo no coincide con la versión fijada.');
  const temporary = new URL('hand_landmarker.task.download', new URL('./', model));
  await writeFile(temporary, bytes); await rename(temporary, model);
}
await writeFile(new URL('public/models/manifest.json', root), JSON.stringify({
  source: modelURL, sha256: sha(bytes), bytes: bytes.length,
}, null, 2) + '\n');
