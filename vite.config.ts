import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { createApp } from './server.mjs';
import { readTechniqueConfig } from './scripts/read-technique-config.mjs';

function labApi(): Plugin {
  const middleware = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(async (req, res, next) => {
      const path = (req.url ?? '/').split('?')[0];
      const legacy = path === '/legacy/' || path === '/legacy';
      if (!['/mcp', '/project.txt', '/config.json'].includes(path) && !legacy && !path.startsWith('/legacy/')) return next();
      try {
        const assets: Record<string, string> = {
          '/project.txt': readFileSync(new URL('./docs/project.txt', import.meta.url), 'utf8'),
          '/config.json': readTechniqueConfig(),
        };
        if (legacy) {
          assets[path] = readFileSync(new URL('./web/index.html', import.meta.url), 'utf8')
            .replaceAll('href="/', 'href="/legacy/').replaceAll('src="/', 'src="/legacy/');
        } else if (path.startsWith('/legacy/')) {
          const filename = path.slice('/legacy/'.length);
          if (!/^[a-zA-Z0-9.-]+$/.test(filename)) { res.writeHead(404); res.end(); return; }
          assets[path] = readFileSync(new URL('./web/' + filename, import.meta.url), 'utf8');
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        const method = req.method ?? 'GET';
        const request = new Request('http://localhost' + req.url, { method, headers,
          ...(method !== 'GET' && method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
        const response = await createApp(assets).fetch(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
      } catch { res.writeHead(404); res.end('Recurso no disponible.'); }
    });
  };
  return { name: 'jujutsu-lab-api', configureServer: middleware, configurePreviewServer: middleware };
}

export default defineConfig({
  plugins: [react(), labApi()],
  server: {
    host: '127.0.0.1', port: 3000,
    headers: { 'Permissions-Policy': 'camera=(self), microphone=()', 'X-Content-Type-Options': 'nosniff' },
  },
  preview: { headers: { 'Permissions-Policy': 'camera=(self), microphone=()' } },
  build: {
    outDir: 'dist/client', target: 'es2022', chunkSizeWarningLimit: 850,
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'three', test: /node_modules[\\/]three[\\/]/ },
      { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
    ] } } },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', maxWorkers: 4 },
});
