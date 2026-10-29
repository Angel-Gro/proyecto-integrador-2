import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const raiz = path.resolve(import.meta.dirname, '..');
const html = await fs.readFile(path.join(raiz, 'chido.html'), 'utf8');
const adaptador = await fs.readFile(path.join(raiz, 'adaptador-datos.js'), 'utf8');
const entrada = `
import { atenderApi } from './servicio-datos.mjs';
const html = ${JSON.stringify(html)};
const adaptador = ${JSON.stringify(adaptador)};
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith('/api/')) return atenderApi(request, { ...env, MODO_NUBE: true });
        if (url.pathname === '/adaptador-datos.js') return new Response(adaptador, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
        if (url.pathname === '/' || url.pathname === '/chido.html') return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
        return new Response('No encontrado', { status: 404 });
    }
};`;
await fs.mkdir(path.join(raiz, 'distribucion', 'web'), { recursive: true });
await build({
    stdin: { contents: entrada, resolveDir: raiz, sourcefile: 'trabajador-entrada.mjs', loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    outfile: path.join(raiz, 'distribucion', 'web', 'trabajador.mjs')
});
