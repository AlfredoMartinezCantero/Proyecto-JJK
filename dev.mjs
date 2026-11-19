import { createServer } from 'vite';

const flag = process.argv.indexOf('--port');
const port = Number(flag === -1 ? process.env.PORT ?? 3000 : process.argv[flag + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Puerto no válido. Usa npm run dev -- --port 3001.');
  process.exit(1);
}
try {
  const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: flag !== -1 } });
  await server.listen();
  console.log('\nJujutsu Gesture Lab · Entrenamiento 3D');
  server.printUrls();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    await server.close(); process.exit(0);
  });
} catch (error) {
  console.error('No se pudo iniciar el servidor:', error.message);
  console.error('Prueba otro puerto: npm run dev -- --port 3001');
  process.exit(1);
}
