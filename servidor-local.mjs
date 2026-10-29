import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SQLite from 'better-sqlite3';
import { atenderApi } from './servicio-datos.mjs';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const carpetaDatos = process.env.REPARTIDORES_DATOS || path.join(raiz, 'datos');
fs.mkdirSync(carpetaDatos, { recursive: true });
const sqlite = new SQLite(path.join(carpetaDatos, 'repartidores.sqlite'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.exec(fs.readFileSync(path.join(raiz, 'esquema.sql'), 'utf8'));

const db = {
    prepare(sql) {
        return {
            bind(...args) {
                const q = sqlite.prepare(sql);
                return {
                    first: async () => q.get(...args) || null,
                    all: async () => ({ results: q.all(...args) }),
                    run: async () => q.run(...args),
                    ejecutar: () => q.run(...args)
                };
            },
            first: async () => sqlite.prepare(sql).get() || null
        };
    },
    async batch(sentencias) {
        sqlite.transaction(() => sentencias.forEach(s => s.ejecutar()))();
    }
};

const archivos = new Map([
    ['/', ['chido.html', 'text/html; charset=utf-8']],
    ['/chido.html', ['chido.html', 'text/html; charset=utf-8']],
    ['/adaptador-datos.js', ['adaptador-datos.js', 'application/javascript; charset=utf-8']]
]);
const puerto = Number(process.argv[2] || 58734);
http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://127.0.0.1:${puerto}`);
        if (url.pathname.startsWith('/api/')) {
            const partes = [];
            for await (const parte of req) {
                partes.push(parte);
                if (partes.reduce((n, x) => n + x.length, 0) > 2_000_000) { res.writeHead(413); res.end(); return; }
            }
            const solicitud = new Request(url, {
                method: req.method,
                headers: req.headers,
                body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(partes)
            });
            const respuesta = await atenderApi(solicitud, { DB: db });
            res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers));
            res.end(Buffer.from(await respuesta.arrayBuffer()));
            return;
        }
        if (url.pathname === '/salud') { res.writeHead(200); res.end('ok'); return; }
        const archivo = archivos.get(url.pathname);
        if (!archivo) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': archivo[1], 'Cache-Control': 'no-store' });
        fs.createReadStream(path.join(raiz, archivo[0])).pipe(res);
    } catch (e) {
        console.error(e);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error interno.');
    }
}).listen(puerto, '127.0.0.1');
