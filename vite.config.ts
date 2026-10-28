import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Runs api/deeper.ts inside the dev server so "Deeper answer" works locally the same way
// it does on Vercel. Put ANTHROPIC_API_KEY in .env.local (never committed) to try it.
function localApi(): Plugin {
  return {
    name: 'kinly-local-api',
    configureServer(server) {
      server.middlewares.use('/api/deeper', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
        const { POST } = await server.ssrLoadModule('/api/deeper.ts');
        const response: Response = await POST(new Request(`http://${req.headers.host}/api/deeper`, { method: 'POST', headers, body: Buffer.concat(chunks) }));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'ANTHROPIC_'));
  return {
    plugins: [react(), localApi()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
