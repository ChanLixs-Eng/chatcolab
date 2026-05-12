// Tests de integración del servidor ChatColab.
// Levantan el HTTP+WS real en un puerto efímero y validan el comportamiento
// observable: HTTP estático, handshake, broadcast, robustez, contador,
// rate limit, validación y desconexión.

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');

const { server, wss, clientes, historial, MAX_HISTORIAL } = require('../server.js');

let baseHttp;
let baseWs;

// ---------- Helpers ----------

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseHttp}${urlPath}`, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body })
        );
      })
      .on('error', reject);
  });
}

function openClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(baseWs);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

// Recoge `n` mensajes parseados del cliente.
function collect(ws, n, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const out = [];
    const t = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error(`timeout esperando ${n} mensajes, recibidos ${out.length}`));
    }, timeoutMs);

    function onMsg(data) {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }
      out.push(parsed);
      if (out.length >= n) {
        clearTimeout(t);
        ws.off('message', onMsg);
        resolve(out);
      }
    }
    ws.on('message', onMsg);
  });
}

// Recoge mensajes hasta encontrar uno que cumpla `predicate`, devuelve todos
// los recibidos. Útil cuando hay tráfico cruzado entre clientes.
function collectUntil(ws, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const out = [];
    const t = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error(`timeout, recibidos ${out.length}`));
    }, timeoutMs);

    function onMsg(data) {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }
      out.push(parsed);
      if (predicate(parsed)) {
        clearTimeout(t);
        ws.off('message', onMsg);
        resolve(out);
      }
    }
    ws.on('message', onMsg);
  });
}

function waitClose(ws) {
  if (ws.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise((resolve) => ws.once('close', resolve));
}

async function waitFor(cond, { timeoutMs = 1500, intervalMs = 10 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function expectNoMessage(ws, predicate, windowMs = 120) {
  return new Promise((resolve, reject) => {
    const onMsg = (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (predicate(parsed)) {
        ws.off('message', onMsg);
        reject(new Error(`mensaje inesperado: ${JSON.stringify(parsed)}`));
      }
    };
    ws.on('message', onMsg);
    setTimeout(() => {
      ws.off('message', onMsg);
      resolve();
    }, windowMs);
  });
}

async function closeAll(...wss) {
  for (const ws of wss) ws.close();
  await Promise.all(wss.map(waitClose));
}

// Envía union y espera la bienvenida (unicast). Devuelve la bienvenida.
async function unirse(ws, nombre) {
  ws.send(JSON.stringify({ tipo: 'union', usuario: nombre }));
  const recibidos = await collectUntil(ws, (m) => m.tipo === 'bienvenida');
  return recibidos.find((m) => m.tipo === 'bienvenida');
}

// Pequeño sleep para superar el rate limit del server entre envíos.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Lifecycle ----------

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseHttp = `http://127.0.0.1:${port}`;
  baseWs = `ws://127.0.0.1:${port}`;
});

after(async () => {
  for (const c of clientes) c.terminate();
  await new Promise((resolve) => wss.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
  for (const c of clientes) c.terminate();
  await waitFor(() => clientes.size === 0);
  historial.length = 0; // evitar test pollution con el historial global
});

// ---------- Suites ----------

describe('HTTP estático', () => {
  test('GET / sirve index.html con 200 y HTML válido', async () => {
    const res = await httpGet('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /text\/html/);
    assert.match(res.body, /<title>ChatColab/);
    assert.match(res.body, /id="pantalla-login"/);
    assert.match(res.body, /id="pantalla-chat"/);
  });

  test('GET /client.js sirve el JS del cliente', async () => {
    const res = await httpGet('/client.js');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /javascript/);
    assert.match(res.body, /WebSocket/);
  });

  test('GET /style.css sirve el CSS', async () => {
    const res = await httpGet('/style.css');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /text\/css/);
  });

  test('GET /no-existe devuelve 404', async () => {
    const res = await httpGet('/no-existe-xyz');
    assert.equal(res.status, 404);
  });
});

describe('Handshake union y bienvenida', () => {
  test('bienvenida unicast incluye id, usuario y total', async () => {
    const a = await openClient();
    const bienvenida = await unirse(a, 'Alicia');

    assert.equal(bienvenida.tipo, 'bienvenida');
    assert.equal(typeof bienvenida.id, 'string');
    assert.ok(bienvenida.id.length >= 8, 'id parece un uuid');
    assert.equal(bienvenida.usuario, 'Alicia');
    assert.equal(bienvenida.total, 1);

    await closeAll(a);
  });

  test('al unirse se broadcastea sistema/union a todos con total actualizado', async () => {
    const a = await openClient();
    const b = await openClient();

    // A se une primero, drena su bienvenida y su propio broadcast.
    const recA = collectUntil(a, (m) => m.tipo === 'sistema' && m.evento === 'union');
    const recB = collectUntil(b, (m) => m.tipo === 'sistema' && m.evento === 'union');
    a.send(JSON.stringify({ tipo: 'union', usuario: 'Alicia' }));

    const aMsgs = await recA;
    const bMsgs = await recB;
    const sysA = aMsgs.find((m) => m.tipo === 'sistema');
    const sysB = bMsgs.find((m) => m.tipo === 'sistema');

    assert.equal(sysA.evento, 'union');
    assert.match(sysA.texto, /Alicia/);
    assert.equal(sysA.total, 1);
    assert.equal(sysB.evento, 'union');
    assert.match(sysB.texto, /Alicia/);
    assert.equal(sysB.total, 1);

    await closeAll(a, b);
  });

  test('total refleja el número de usuarios presentes', async () => {
    const a = await openClient();
    const b = await openClient();
    const c = await openClient();

    const bvA = await unirse(a, 'A');
    assert.equal(bvA.total, 1);

    const bvB = await unirse(b, 'B');
    assert.equal(bvB.total, 2);

    const bvC = await unirse(c, 'C');
    assert.equal(bvC.total, 3);

    await closeAll(a, b, c);
  });

  test('union con nombre vacío o no-string se ignora', async () => {
    const a = await openClient();

    const noBienvenida = expectNoMessage(a, (m) => m.tipo === 'bienvenida');
    a.send(JSON.stringify({ tipo: 'union', usuario: '' }));
    a.send(JSON.stringify({ tipo: 'union', usuario: '    ' }));
    a.send(JSON.stringify({ tipo: 'union', usuario: 123 }));
    a.send(JSON.stringify({ tipo: 'union' }));
    await noBienvenida;

    await closeAll(a);
  });

  test('usuario excesivamente largo se trunca a 20 chars', async () => {
    const a = await openClient();
    const nombreLargo = 'X'.repeat(100);
    const bv = await unirse(a, nombreLargo);
    assert.equal(bv.usuario.length, 20);
    await closeAll(a);
  });
});

describe('Mensajes de chat', () => {
  test('un mensaje válido llega a TODOS los clientes con id, usuario y hora server', async () => {
    const a = await openClient();
    const b = await openClient();

    const bvA = await unirse(a, 'Ana');
    await unirse(b, 'Bruno');

    // Drenar el broadcast cruzado de la union de B en A.
    await collectUntil(a, (m) => m.tipo === 'sistema' && /Bruno/.test(m.texto));

    const recA = collectUntil(a, (m) => m.tipo === 'mensaje');
    const recB = collectUntil(b, (m) => m.tipo === 'mensaje');
    a.send(JSON.stringify({ tipo: 'mensaje', texto: 'hola mundo' }));

    const msgA = (await recA).find((m) => m.tipo === 'mensaje');
    const msgB = (await recB).find((m) => m.tipo === 'mensaje');

    for (const m of [msgA, msgB]) {
      assert.equal(m.tipo, 'mensaje');
      assert.equal(m.usuario, 'Ana');
      assert.equal(m.texto, 'hola mundo');
      assert.equal(m.id, bvA.id, 'el id viene del server, igual al de bienvenida');
      assert.match(m.hora, /^\d{2}:\d{2}$/, 'hora con formato HH:MM');
    }

    await closeAll(a, b);
  });

  test('hora la pone el servidor (ignora la del cliente)', async () => {
    const a = await openClient();
    await unirse(a, 'H');

    const rec = collectUntil(a, (m) => m.tipo === 'mensaje');
    a.send(JSON.stringify({ tipo: 'mensaje', texto: 'hi', hora: 'PWNED' }));
    const msg = (await rec).find((m) => m.tipo === 'mensaje');

    assert.notEqual(msg.hora, 'PWNED');
    assert.match(msg.hora, /^\d{2}:\d{2}$/);

    await closeAll(a);
  });

  test('texto se trimea y se trunca a 500 caracteres', async () => {
    const a = await openClient();
    await unirse(a, 'Trim');

    const rec1 = collectUntil(a, (m) => m.tipo === 'mensaje');
    a.send(JSON.stringify({ tipo: 'mensaje', texto: '   con espacios   ' }));
    const m1 = (await rec1).find((m) => m.tipo === 'mensaje');
    assert.equal(m1.texto, 'con espacios');

    await sleep(80); // respetar rate limit

    const rec2 = collectUntil(a, (m) => m.tipo === 'mensaje');
    a.send(JSON.stringify({ tipo: 'mensaje', texto: 'A'.repeat(1000) }));
    const m2 = (await rec2).find((m) => m.tipo === 'mensaje');
    assert.equal(m2.texto.length, 500);

    await closeAll(a);
  });

  test('mensaje sin union previo aparece como "Anónimo" con id de la conexión', async () => {
    const a = await openClient();
    const b = await openClient();
    await unirse(b, 'Espia');
    // B ya está dentro; consumimos su propia union.
    // A no envía union: su id existe pero ws.usuario es null.

    const rec = collectUntil(b, (m) => m.tipo === 'mensaje');
    a.send(JSON.stringify({ tipo: 'mensaje', texto: 'sin nombre' }));
    const m = (await rec).find((mm) => mm.tipo === 'mensaje');

    assert.equal(m.tipo, 'mensaje');
    assert.equal(m.usuario, 'Anónimo');
    assert.equal(m.texto, 'sin nombre');
    assert.equal(typeof m.id, 'string');

    await closeAll(a, b);
  });

  test('texto vacío o solo espacios NO se broadcastea', async () => {
    const a = await openClient();
    await unirse(a, 'Vacio');

    const noMensaje = expectNoMessage(a, (m) => m.tipo === 'mensaje');
    a.send(JSON.stringify({ tipo: 'mensaje', texto: '' }));
    a.send(JSON.stringify({ tipo: 'mensaje', texto: '     ' }));
    a.send(JSON.stringify({ tipo: 'mensaje' }));
    await noMensaje;

    await closeAll(a);
  });

  test('dos clientes con el mismo nombre tienen ids distintos', async () => {
    const a = await openClient();
    const b = await openClient();

    const bvA = await unirse(a, 'Pepe');
    const bvB = await unirse(b, 'Pepe');

    assert.equal(bvA.usuario, 'Pepe');
    assert.equal(bvB.usuario, 'Pepe');
    assert.notEqual(bvA.id, bvB.id);

    await closeAll(a, b);
  });
});

describe('Rate limit', () => {
  test('mensajes muy seguidos del mismo cliente se descartan', async () => {
    const a = await openClient();
    await unirse(a, 'Flood');

    const recibidos = [];
    const onMsg = (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.tipo === 'mensaje') recibidos.push(parsed);
    };
    a.on('message', onMsg);

    // 5 mensajes en ráfaga: el rate limit (50ms) debería descartar al menos 1.
    for (let i = 0; i < 5; i++) {
      a.send(JSON.stringify({ tipo: 'mensaje', texto: `m${i}` }));
    }
    await sleep(150);

    a.off('message', onMsg);

    assert.ok(
      recibidos.length >= 1 && recibidos.length < 5,
      `esperaba 1..4 mensajes, recibidos ${recibidos.length}`
    );

    await closeAll(a);
  });
});

describe('Robustez frente a entradas inválidas', () => {
  test('JSON inválido no rompe al servidor ni afecta a otros clientes', async () => {
    const a = await openClient();
    const b = await openClient();

    await unirse(a, 'Sano');
    await unirse(b, 'Sana');
    // Drenar broadcasts cruzados.
    await collectUntil(a, (m) => m.tipo === 'sistema' && /Sana/.test(m.texto));

    b.send('esto-no-es-json{{{');

    const recA = collectUntil(a, (m) => m.tipo === 'mensaje');
    const recB = collectUntil(b, (m) => m.tipo === 'mensaje');
    a.send(JSON.stringify({ tipo: 'mensaje', texto: 'sigo vivo' }));
    const mA = (await recA).find((m) => m.tipo === 'mensaje');
    const mB = (await recB).find((m) => m.tipo === 'mensaje');
    assert.equal(mA.texto, 'sigo vivo');
    assert.equal(mB.texto, 'sigo vivo');

    await closeAll(a, b);
  });

  test('tipo desconocido se ignora silenciosamente', async () => {
    const a = await openClient();
    await unirse(a, 'X');

    const noNada = expectNoMessage(a, () => true);
    a.send(JSON.stringify({ tipo: 'fantasia', algo: 1 }));
    await noNada;

    await closeAll(a);
  });
});

describe('Desconexión', () => {
  test('cliente con nombre que se cierra → broadcast "salida" con total decrementado', async () => {
    const a = await openClient();
    const b = await openClient();

    await unirse(a, 'Adios');
    await unirse(b, 'Quedo');
    await collectUntil(a, (m) => m.tipo === 'sistema' && /Quedo/.test(m.texto));

    const recB = collectUntil(b, (m) => m.tipo === 'sistema' && m.evento === 'salida');
    a.close();
    const salida = (await recB).find((m) => m.tipo === 'sistema' && m.evento === 'salida');

    assert.equal(salida.evento, 'salida');
    assert.match(salida.texto, /Adios/);
    assert.equal(salida.total, 1);

    await closeAll(b);
  });

  test('cliente sin nombre que se cierra NO emite "salida"', async () => {
    const a = await openClient();
    const b = await openClient();
    await unirse(b, 'Testigo');

    const noSalida = expectNoMessage(
      b,
      (m) => m.tipo === 'sistema' && m.evento === 'salida'
    );
    a.close();
    await waitClose(a);
    await noSalida;

    await closeAll(b);
  });

  test('el set interno de clientes refleja conexiones y desconexiones', async () => {
    assert.equal(clientes.size, 0);

    const a = await openClient();
    const b = await openClient();
    await waitFor(() => clientes.size === 2);

    a.close();
    await waitClose(a);
    await waitFor(() => clientes.size === 1);

    b.close();
    await waitClose(b);
    await waitFor(() => clientes.size === 0);
  });
});

describe('Historial de mensajes', () => {
  test('la bienvenida incluye un array historial', async () => {
    const a = await openClient();
    const bv = await unirse(a, 'Hist');
    assert.ok(Array.isArray(bv.historial), 'historial debe ser array');
    await closeAll(a);
  });

  test('historial preserva el orden cronológico', async () => {
    const a = await openClient();
    await unirse(a, 'A');

    for (const texto of ['uno', 'dos', 'tres']) {
      a.send(JSON.stringify({ tipo: 'mensaje', texto }));
      await sleep(70); // respetar rate limit (50 ms)
    }

    const b = await openClient();
    const bv = await unirse(b, 'B');

    const textos = bv.historial.map((m) => m.texto);
    assert.deepEqual(textos, ['uno', 'dos', 'tres']);

    await closeAll(a, b);
  });

  test(`historial se limita a ${MAX_HISTORIAL} mensajes y descarta los más antiguos`, async () => {
    const a = await openClient();
    await unirse(a, 'Burst');

    const N = MAX_HISTORIAL + 5;
    for (let i = 0; i < N; i++) {
      a.send(JSON.stringify({ tipo: 'mensaje', texto: `m${i}` }));
      await sleep(60);
    }

    const b = await openClient();
    const bv = await unirse(b, 'Late');

    assert.equal(bv.historial.length, MAX_HISTORIAL);
    assert.equal(bv.historial[0].texto, `m${N - MAX_HISTORIAL}`);
    assert.equal(bv.historial[MAX_HISTORIAL - 1].texto, `m${N - 1}`);

    await closeAll(a, b);
  });
});

describe('Multi-cliente', () => {
  test('5 clientes reciben el mismo mensaje broadcast', async () => {
    const N = 5;
    const conns = await Promise.all(Array.from({ length: N }, openClient));

    for (let i = 0; i < N; i++) {
      await unirse(conns[i], `U${i}`);
    }
    // Cada cliente puede tener broadcasts pendientes; lo importante es que
    // todos vean el siguiente mensaje.

    const promesas = conns.map((c) => collectUntil(c, (m) => m.tipo === 'mensaje'));
    conns[0].send(JSON.stringify({ tipo: 'mensaje', texto: 'broadcast' }));
    const resultados = await Promise.all(promesas);

    for (const recibidos of resultados) {
      const m = recibidos.find((x) => x.tipo === 'mensaje');
      assert.equal(m.tipo, 'mensaje');
      assert.equal(m.usuario, 'U0');
      assert.equal(m.texto, 'broadcast');
    }

    await closeAll(...conns);
  });
});
