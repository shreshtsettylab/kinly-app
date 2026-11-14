import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { blogIndexMeta, blogPosts, postTitle } from './src/marketing/blogPosts';

// Runs the api/*.ts functions inside the dev server so they work locally the same way they do
// on Vercel (api/ai.ts also reads the public VITE_SUPABASE_ values). Put the CLOUDFLARE_ AI settings and the RAZORPAY_ keys in .env.local (never committed).
const API_ROUTES = ['ai', 'create-order', 'verify-payment', 'plus-subscribe', 'plus-verify', 'plus-cancel', 'razorpay-webhook'];

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

// Writes dist/blog/index.html and dist/blog/<slug>/index.html: copies of the app shell whose
// <title>, description and Open Graph tags match the page, because WhatsApp and LinkedIn read
// link previews from the HTML without running JavaScript. Vercel serves these files directly;
// any other /blog/ address has no file, so it gets the static 404 page.
function blogPages(): Plugin {
  const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const page = (shell: string, title: string, description: string, path: string, type: string) => {
    const url = `https://www.kinly.in${path}`;
    const set = (html: string, pattern: RegExp, value: string) => {
      if (!pattern.test(html)) throw new Error(`blogPages: ${pattern} not found in index.html`);
      return html.replace(pattern, `$1${attr(value)}$2`);
    };
    let html = set(shell, /(<title>)[^<]*(<\/title>)/, title);
    html = set(html, /(<meta name="description" content=")[^"]*(")/, description);
    html = set(html, /(<link rel="canonical" href=")[^"]*(")/, url);
    html = set(html, /(<meta property="og:type" content=")[^"]*(")/, type);
    html = set(html, /(<meta property="og:url" content=")[^"]*(")/, url);
    html = set(html, /(<meta property="og:title" content=")[^"]*(")/, title);
    html = set(html, /(<meta property="og:description" content=")[^"]*(")/, description);
    html = set(html, /(<meta property="og:image:alt" content=")[^"]*(")/, title);
    html = set(html, /(<meta name="twitter:title" content=")[^"]*(")/, title);
    return set(html, /(<meta name="twitter:description" content=")[^"]*(")/, description);
  };
  let outDir = 'dist';
  return {
    name: 'kinly-blog-pages',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const shell = readFileSync(`${outDir}/index.html`, 'utf8');
      mkdirSync(`${outDir}/blog`, { recursive: true });
      writeFileSync(`${outDir}/blog/index.html`, page(shell, blogIndexMeta.title, blogIndexMeta.description, '/blog', 'website'));
      for (const post of blogPosts) {
        mkdirSync(`${outDir}/blog/${post.slug}`, { recursive: true });
        writeFileSync(`${outDir}/blog/${post.slug}/index.html`, page(shell, postTitle(post), post.description, `/blog/${post.slug}`, 'article'));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ['CLOUDFLARE_', 'OPENROUTER_', 'RAZORPAY_', 'VITE_SUPABASE_', 'SUPABASE_SECRET_']));
  return {
    plugins: [react(), localApi(), blogPages()],
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
