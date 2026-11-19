import { expect, it } from 'vitest';
import { createApp } from '../server.mjs';
import { readTechniqueConfig } from '../scripts/read-technique-config.mjs';

it('preserves the original MCP tools and config', async () => {
  const config = JSON.stringify({ technique: { id: 'blue-adapted' } });
  const app = createApp({ '/project.txt': 'Local 3D project plan', '/config.json': config });
  async function rpc(method: string, name?: string) {
    return (await app.fetch(new Request('https://test/mcp', { method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { name, arguments: {} } }) }))).json();
  }
  const list = await rpc('tools/list');
  expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(['get_project_plan', 'get_technique_config']);
  expect((await rpc('tools/call', 'get_technique_config')).result.content[0].text).toBe(config);
  expect((await rpc('tools/call', 'get_project_plan')).result.content[0].text).toContain('3D');
});

it('serves all four character catalogs while retaining the five Gojo lessons and legacy Azul schema', async () => {
  const config = JSON.parse(readTechniqueConfig());
  expect(config.technique.id).toBe('blue-adapted'); expect(config.technique.holdMs).toBe(1200);
  expect(config.techniques.filter((t: { character: string }) => t.character === 'gojo').map((t: { key: string }) => t.key)).toEqual(['blue', 'red', 'fusion', 'purple', 'domain']);
  expect(config.techniques.filter((t: { character: string }) => t.character === 'sukuna').map((t: { key: string }) => t.key)).toEqual(['dismantle', 'cleave', 'flame', 'shrine']);
  expect(config.characters).toEqual(['gojo','sukuna','yuji','megumi']);
  expect(config.techniques.filter((t: { character: string }) => t.character === 'yuji').map((t: { key: string }) => t.key)).toEqual(['divergent','black-flash']);
  expect(config.techniques.filter((t: { character: string }) => t.character === 'megumi').map((t: { key: string }) => t.key)).toEqual(['divine-dogs','nue','totality','toad','max-elephant','rabbit-escape','mahoraga','chimera-garden']);
  const app = createApp({ '/config.json': JSON.stringify(config), '/project.txt': 'Gojo local catalog' });
  const response = await app.fetch(new Request('https://test/mcp', { method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_technique_config' } }) }));
  const rpc = await response.json(); expect(JSON.parse(rpc.result.content[0].text).techniques).toHaveLength(19);
});
