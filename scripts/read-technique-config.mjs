import { readFileSync } from 'node:fs';

export function readTechniqueConfig() {
  const legacy = JSON.parse(readFileSync(new URL('../web/config.json', import.meta.url), 'utf8'));
  const catalog = JSON.parse(readFileSync(new URL('../src/config/gojo.json', import.meta.url), 'utf8'));
  const sukuna = JSON.parse(readFileSync(new URL('../src/config/sukuna.json', import.meta.url), 'utf8'));
  const yuji = JSON.parse(readFileSync(new URL('../src/config/yuji.json', import.meta.url), 'utf8'));
  const megumi = JSON.parse(readFileSync(new URL('../src/config/megumi.json', import.meta.url), 'utf8'));
  const gestureProfiles = JSON.parse(readFileSync(new URL('../src/config/pose-precision.json', import.meta.url), 'utf8'));
  const blue = catalog.techniques.find(t => t.key === 'blue');
  return JSON.stringify({ ...legacy, version: 7, characters: ['gojo', 'sukuna', 'yuji', 'megumi'], gestureProfiles,
    technique: { ...legacy.technique, name: blue.name, instructions: blue.instructions.join(' '),
      ...blue.timing, effect: { ...legacy.technique.effect, durationMs: blue.effectMs } },
    techniques: [...catalog.techniques.map(t => ({ ...t, character: 'gojo' })), ...sukuna.techniques.map(t => ({ ...t, character: 'sukuna' })), ...yuji.techniques.map(t => ({ ...t, character: 'yuji' })), ...megumi.techniques.map(t => ({ ...t, character: 'megumi' }))],
    note: 'Catálogos locales de Gojo, Sukuna, Yuji y Megumi. Gestos adaptados; recursos y cámara solo en la aplicación.' }, null, 2);
}
