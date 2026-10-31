import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Runs the api/*.ts functions inside the dev server so they work locally the same way they do
// on Vercel (api/ai.ts also reads the public VITE_SUPABASE_ values). Put OPENROUTER_API_KEY and the RAZORPAY_ keys in .env.local (never committed).
const API_ROUTES = ['ai', 'create-order', 'verify-payment'];

function localApi(): Plugin {
  return {
    name: 'kinly-local-api',
    configureServer(server) {
      for (const name of API_ROUTES) server.middlewares.use(`/api/${name}`, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
        const { POST } = await server.ssrLoadModule(`/api/${name}.ts`);
        const response: Response = await POST(new Request(`http://${req.headers.host}/api/${name}`, { method: 'POST', headers, body: Buffer.concat(chunks) }));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ['OPENROUTER_', 'RAZORPAY_', 'VITE_SUPABASE_']));
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
