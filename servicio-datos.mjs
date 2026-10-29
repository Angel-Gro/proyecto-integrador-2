const colecciones = ['usuarios', 'accesos', 'tiendas', 'repartidores', 'pedidos', 'reportes', 'colonias', 'historialDemanda'];
const roles = new Set(['admin', 'tienda', 'repartidor']);
const json = (valor, estado = 200, cookie = null) => new Response(JSON.stringify(valor), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) }
});
const fallo = (mensaje, estado = 400, code = 'api/error') => json({ error: mensaje, code }, estado);
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function clave(pass, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes(salt), iterations: 100000, hash: 'SHA-256' }, material, 256);
    return b64(new Uint8Array(bits));
}

async function perfil(db, uid) {
    if (!uid) return null;
    const d = await doc(db, 'usuarios', uid);
    return d?.data || null;
}
async function doc(db, coleccion, id) {
    const r = await db.prepare('SELECT datos, version FROM documentos WHERE coleccion = ? AND id = ?').bind(coleccion, id).first();
    return r ? { id, data: JSON.parse(r.datos), version: r.version } : null;
}
async function lista(db, coleccion) {
    const r = await db.prepare('SELECT id, datos, version FROM documentos WHERE coleccion = ? ORDER BY id').bind(coleccion).all();
    return (r.results || []).map(x => ({ id: x.id, data: JSON.parse(x.datos), version: x.version }));
}
async function cuenta(db, email) {
    return db.prepare('SELECT uid, email, salt, hash FROM cuentas WHERE email = ?').bind(email.toLowerCase()).first();
}
async function sesion(db, req) {
    const token = /(?:^|; )sesion=([^;]+)/.exec(req.headers.get('Cookie') || '')?.[1];
    if (!token) return null;
    const r = await db.prepare('SELECT cuenta_uid FROM sesiones WHERE token = ? AND vence > ?').bind(token, Date.now()).first();
    if (!r) return null;
    const c = await db.prepare('SELECT uid, email FROM cuentas WHERE uid = ?').bind(r.cuenta_uid).first();
    return c ? { uid: c.uid, email: c.email, token } : null;
}
function puedeLeer(c, d, user, p, individual) {
    if (c === 'accesos') return false;
    if (!p) return false;
    if (c === 'usuarios') return p.rol === 'admin' || (individual && user.uid === d.id);
    if (c === 'tiendas' || c === 'repartidores') return true;
    if (c === 'pedidos') return p.rol === 'admin' || (p.rol === 'tienda' && d.data.tienda === p.refId) || (p.rol === 'repartidor' && d.data.repartidorAsignado === p.refId);
    return p.rol === 'admin';
}
function puedeEscribir(op, previo, p) {
    if (!p) return false;
    const c = op.coleccion, d = op.data || {}, old = previo?.data || {};
    if (p.rol === 'admin') return true;
    if (c === 'repartidores' && op.tipo === 'update') {
        const claves = Object.keys(d);
        if (p.rol === 'tienda') return claves.every(k => ['carga', 'pedidosIds'].includes(k));
        return op.id === p.refId && claves.every(k => ['lat', 'lng', 'carga', 'pedidosIds', 'itin'].includes(k));
    }
    if (c === 'pedidos') {
        if (p.rol === 'tienda' && op.tipo === 'set' && !previo) return d.tienda === p.refId && ['Pendiente', 'En Ruta'].includes(d.estado);
        if (p.rol === 'tienda' && op.tipo === 'update') return old.tienda === p.refId && old.estado === 'Pendiente' && Object.keys(d).every(k => ['estado', 'repartidorAsignado'].includes(k));
        if (p.rol === 'repartidor' && op.tipo === 'update') return old.repartidorAsignado === p.refId && Object.keys(d).every(k => ['recogido', 'recogidoEn', 'estado', 'entregadoEn'].includes(k));
    }
    if (c === 'reportes' && p.rol === 'repartidor' && op.tipo === 'set' && !previo) return d.repartidorId === p.refId;
    return false;
}
function operacionSql(op, previo) {
    if (op.tipo === 'delete') return ['DELETE FROM documentos WHERE coleccion = ? AND id = ?', op.coleccion, op.id];
    const datos = op.tipo === 'update' ? { ...previo.data, ...op.data } : op.data;
    return ['INSERT INTO documentos (coleccion, id, datos, version) VALUES (?, ?, ?, 1) ON CONFLICT(coleccion,id) DO UPDATE SET datos = excluded.datos, version = documentos.version + 1', op.coleccion, op.id, JSON.stringify(datos)];
}

export async function atenderApi(req, env) {
    const db = env.DB;
    const url = new URL(req.url);
    const ruta = url.pathname.replace(/^\/api\/?/, '');
    try {
        if (req.method !== 'GET') {
            const origen = req.headers.get('Origin');
            if (origen && origen !== url.origin) return fallo('Origen no permitido.', 403);
            if (req.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return fallo('Se requiere JSON.');
        }
        const user = await sesion(db, req);
        const p = await perfil(db, user?.uid);
        if (ruta === 'preparacion' && req.method === 'GET') {
            const r = await db.prepare('SELECT COUNT(*) AS n FROM cuentas').first();
            return json({ pendiente: !r.n });
        }
        if (ruta === 'preparar' && req.method === 'POST') {
            const r = await db.prepare('SELECT COUNT(*) AS n FROM cuentas').first();
            if (r.n) return fallo('La administración ya está preparada.', 409);
            if (env.MODO_NUBE && !env.CLAVE_PREPARACION) return fallo('Falta configurar la preparación segura.', 503);
            const v = await req.json();
            if (env.CLAVE_PREPARACION && v.codigo !== env.CLAVE_PREPARACION) return fallo('Código de preparación incorrecto.', 403);
            if (!/^\S+@\S+\.\S+$/.test(v.email || '') || (v.pass || '').length < 10) return fallo('Ingresa un correo válido y una contraseña de al menos 10 caracteres.');
            const uid = crypto.randomUUID(), salt = b64(crypto.getRandomValues(new Uint8Array(16)));
            const hash = await clave(v.pass, salt);
            await db.batch([
                db.prepare('INSERT INTO cuentas(uid,email,salt,hash) VALUES(?,?,?,?)').bind(uid, v.email.toLowerCase(), salt, hash),
                db.prepare('INSERT INTO documentos(coleccion,id,datos,version) VALUES(?,?,?,1)').bind('usuarios', uid, JSON.stringify({ rol: 'admin', email: v.email.toLowerCase() }))
            ]);
            return json({ ok: true });
        }
        if (ruta === 'sesion' && req.method === 'GET') return json({ user: user ? { uid: user.uid, email: user.email } : null });
        if (ruta === 'iniciar' && req.method === 'POST') {
            const v = await req.json();
            const ident = String(v.email || '').trim();
            let email = ident;
            if (!ident.includes('@')) {
                const acceso = await doc(db, 'accesos', ident.toUpperCase());
                email = acceso?.data?.email || '';
            }
            const c = await cuenta(db, email);
            if (!c || c.hash !== await clave(String(v.pass || ''), c.salt) || !await perfil(db, c.uid)) return fallo('Usuario o contraseña incorrectos.', 401, 'auth/invalid-credential');
            const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            await db.prepare('INSERT INTO sesiones(token,cuenta_uid,vence) VALUES(?,?,?)').bind(token, c.uid, Date.now() + 7 * 864e5).run();
            const cookie = `sesion=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${url.protocol === 'https:' ? '; Secure' : ''}`;
            return json({ user: { uid: c.uid, email: c.email } }, 200, cookie);
        }
        if (ruta === 'salir' && req.method === 'POST') {
            if (user) await db.prepare('DELETE FROM sesiones WHERE token = ?').bind(user.token).run();
            return json({ ok: true }, 200, 'sesion=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        }
        if (ruta === 'crear-cuenta' && req.method === 'POST') {
            if (p?.rol !== 'admin') return fallo('Acceso denegado.', 403);
            const v = await req.json();
            if (!/^\S+@\S+\.\S+$/.test(v.email || '') || (v.pass || '').length < 10) return fallo('Correo o contraseña inválidos.');
            if (await cuenta(db, v.email)) return fallo('Ese correo ya está registrado.', 409, 'auth/email-already-in-use');
            const uid = crypto.randomUUID(), salt = b64(crypto.getRandomValues(new Uint8Array(16)));
            await db.prepare('INSERT INTO cuentas(uid,email,salt,hash) VALUES(?,?,?,?)').bind(uid, v.email.toLowerCase(), salt, await clave(v.pass, salt)).run();
            return json({ uid });
        }
        if (ruta === 'borrar-cuenta' && req.method === 'POST') {
            if (p?.rol !== 'admin') return fallo('Acceso denegado.', 403);
            const v = await req.json();
            await db.prepare('DELETE FROM cuentas WHERE uid = ?').bind(v.uid).run();
            return json({ ok: true });
        }
        if (ruta === 'documento' && req.method === 'GET') {
            const c = url.searchParams.get('coleccion'), id = url.searchParams.get('id');
            if (!colecciones.includes(c) || !id) return fallo('Documento inválido.');
            const d = await doc(db, c, id);
            if (c === 'accesos' || (d && !puedeLeer(c, d, user, p, true))) return fallo('Acceso denegado.', 403);
            if (!d && !p && c !== 'accesos') return fallo('Acceso denegado.', 403);
            return json(d || { id, exists: false, version: 0 });
        }
        if (ruta === 'coleccion' && req.method === 'GET') {
            const c = url.searchParams.get('nombre');
            if (!colecciones.includes(c) || !p || c === 'accesos') return fallo('Acceso denegado.', 403);
            return json({ docs: (await lista(db, c)).filter(d => puedeLeer(c, d, user, p, false)) });
        }
        if (ruta === 'estado' && req.method === 'GET') {
            if (!p) return fallo('Inicia sesión.', 401);
            const resultado = {};
            for (const c of colecciones.filter(x => x !== 'accesos')) resultado[c] = (await lista(db, c)).filter(d => puedeLeer(c, d, user, p, false));
            return json(resultado);
        }
        if (ruta === 'operar' && req.method === 'POST') {
            if (!p || !roles.has(p.rol)) return fallo('Inicia sesión.', 401);
            const v = await req.json(), ops = v.ops || [], esperado = v.esperado || [];
            if (!Array.isArray(ops) || ops.length < 1 || ops.length > 200 || !Array.isArray(esperado)) return fallo('Operación inválida.');
            for (const e of esperado) {
                const actual = await doc(db, e.coleccion, e.id);
                if ((actual?.version || 0) !== e.version) return fallo('Los datos cambiaron. Vuelve a intentar.', 409, 'api/conflict');
            }
            const sentencias = [];
            for (const op of ops) {
                if (!colecciones.includes(op.coleccion) || typeof op.id !== 'string' || op.id.length > 100 || !['set', 'update', 'delete'].includes(op.tipo)) return fallo('Operación inválida.');
                if (op.tipo !== 'delete' && (!op.data || typeof op.data !== 'object' || JSON.stringify(op.data).length > 100000)) return fallo('Datos inválidos.');
                const previo = await doc(db, op.coleccion, op.id);
                if (op.tipo === 'update' && !previo) return fallo('El registro ya no existe.', 404);
                if (!puedeEscribir(op, previo, p)) return fallo('Acceso denegado.', 403);
                const [sql, ...args] = operacionSql(op, previo);
                sentencias.push(db.prepare(sql).bind(...args));
                if (p.rol === 'admin' && op.coleccion === 'usuarios' && op.tipo === 'delete')
                    sentencias.push(db.prepare('DELETE FROM cuentas WHERE uid = ?').bind(op.id));
            }
            await db.batch(sentencias);
            return json({ ok: true });
        }
        return fallo('Ruta desconocida.', 404);
    } catch (e) {
        console.error(e);
        return fallo('Error interno del servidor.', 500);
    }
}
