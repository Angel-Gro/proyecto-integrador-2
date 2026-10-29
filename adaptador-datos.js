(() => {
    const listeners = new Set();
    let snapshot = null;
    let timer = null;
    let usuario = null;
    let cambioSesion = null;

    async function solicitar(ruta, opciones = {}) {
        const respuesta = await fetch('/api/' + ruta, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            ...opciones
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) throw Object.assign(new Error(datos.error || 'No se pudo completar la solicitud.'), { code: datos.code || 'api/error' });
        return datos;
    }

    const documento = (coleccion, d) => ({
        id: d.id,
        exists: d.exists !== false,
        version: d.version,
        data: () => d.data,
        ref: referencia(coleccion, d.id)
    });
    const conjunto = (coleccion, docs) => ({
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.map(d => documento(coleccion, d)),
        forEach(fn) { this.docs.forEach(fn); }
    });

    function referencia(coleccion, id) {
        return {
            id,
            coleccion,
            async get() {
                const r = await solicitar('documento?coleccion=' + encodeURIComponent(coleccion) + '&id=' + encodeURIComponent(id));
                return documento(coleccion, r);
            },
            async set(data) { await operar([{ tipo: 'set', coleccion, id, data }]); },
            async update(data) { await operar([{ tipo: 'update', coleccion, id, data }]); },
            async delete() { await operar([{ tipo: 'delete', coleccion, id }]); }
        };
    }

    async function operar(ops, esperado = []) {
        const r = await solicitar('operar', { method: 'POST', body: JSON.stringify({ ops, esperado }) });
        refrescar().catch(console.error);
        return r;
    }

    function consulta(coleccion, filtro = null, maximo = null) {
        return {
            where(campo, operador, valor) {
                if (operador !== '==') throw new Error('Filtro no compatible.');
                return consulta(coleccion, { campo, valor }, maximo);
            },
            limit(n) { return consulta(coleccion, filtro, n); },
            doc(id = crypto.randomUUID()) { return referencia(coleccion, id); },
            async add(data) { const ref = referencia(coleccion, crypto.randomUUID()); await ref.set(data); return ref; },
            async get() {
                const r = await solicitar('coleccion?nombre=' + encodeURIComponent(coleccion));
                let docs = r.docs;
                if (filtro) docs = docs.filter(d => d.data?.[filtro.campo] === filtro.valor);
                if (maximo != null) docs = docs.slice(0, maximo);
                return conjunto(coleccion, docs);
            },
            onSnapshot(fn, fallo) {
                const l = { coleccion, filtro, maximo, fn, fallo };
                listeners.add(l);
                if (!timer) timer = setInterval(() => { if (!document.hidden) refrescar().catch(console.error); }, 20000);
                refrescar().catch(e => fallo?.(e));
                return () => {
                    listeners.delete(l);
                    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
                };
            }
        };
    }

    let refrescando = null;
    async function refrescar() {
        if (refrescando) return refrescando;
        refrescando = (async () => {
            if (!usuario || !listeners.size) return;
            snapshot = await solicitar('estado');
            for (const l of [...listeners]) {
                try {
                    let docs = snapshot[l.coleccion] || [];
                    if (l.filtro) docs = docs.filter(d => d.data?.[l.filtro.campo] === l.filtro.valor);
                    if (l.maximo != null) docs = docs.slice(0, l.maximo);
                    l.fn(conjunto(l.coleccion, docs));
                } catch (e) { l.fallo?.(e); }
            }
        })().finally(() => { refrescando = null; });
        return refrescando;
    }

    const db = {
        collection: consulta,
        batch() {
            const ops = [];
            return {
                set(ref, data) { ops.push({ tipo: 'set', coleccion: ref.coleccion, id: ref.id, data }); },
                update(ref, data) { ops.push({ tipo: 'update', coleccion: ref.coleccion, id: ref.id, data }); },
                delete(ref) { ops.push({ tipo: 'delete', coleccion: ref.coleccion, id: ref.id }); },
                commit() { return operar(ops); }
            };
        },
        async runTransaction(fn) {
            for (let intento = 0; intento < 3; intento++) {
                const ops = [], esperado = [];
                const tx = {
                    async get(ref) { const d = await ref.get(); esperado.push({ coleccion: ref.coleccion, id: ref.id, version: d.version || 0 }); return d; },
                    set(ref, data) { ops.push({ tipo: 'set', coleccion: ref.coleccion, id: ref.id, data }); },
                    update(ref, data) { ops.push({ tipo: 'update', coleccion: ref.coleccion, id: ref.id, data }); },
                    delete(ref) { ops.push({ tipo: 'delete', coleccion: ref.coleccion, id: ref.id }); }
                };
                const resultado = await fn(tx);
                try { if (ops.length) await operar(ops, esperado); return resultado; }
                catch (e) { if (e.code !== 'api/conflict' || intento === 2) throw e; }
            }
        }
    };

    const auth = {
        get currentUser() { return usuario; },
        onAuthStateChanged(fn) {
            cambioSesion = fn;
            solicitar('sesion').then(r => { usuario = r.user || null; fn(usuario); }).catch(() => fn(null));
        },
        async signInWithEmailAndPassword(email, pass) {
            const r = await solicitar('iniciar', { method: 'POST', body: JSON.stringify({ email, pass }) });
            usuario = r.user;
            await cambioSesion?.(usuario);
            return { user: usuario };
        },
        async signOut() {
            await solicitar('salir', { method: 'POST', body: '{}' });
            usuario = null;
            await cambioSesion?.(null);
        }
    };

    const secondaryAuth = {
        async createUserWithEmailAndPassword(email, pass) {
            const r = await solicitar('crear-cuenta', { method: 'POST', body: JSON.stringify({ email, pass }) });
            return { user: { uid: r.uid, delete: () => solicitar('borrar-cuenta', { method: 'POST', body: JSON.stringify({ uid: r.uid }) }) } };
        },
        async signOut() {}
    };

    window.db = db;
    window.auth = auth;
    window.secondaryAuth = secondaryAuth;
    window.refrescarDatos = refrescar;
})();
