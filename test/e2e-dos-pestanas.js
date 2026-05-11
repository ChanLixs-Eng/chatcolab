// Simulación end-to-end: dos "pestañas" del navegador hablando con el
// servidor real en ws://localhost:3000. Imprime cada paso para verificar
// visualmente que el chat funciona como debería.

const WebSocket = require('ws');

const URL = 'ws://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function color(name) {
  return name === 'Ana' ? '\x1b[36m' : '\x1b[35m'; // cyan / magenta
}
const reset = '\x1b[0m';
const gray = '\x1b[90m';

function pestania(nombre) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const estado = { id: null, total: null, recibidos: [] };

    ws.on('open', () => {
      console.log(`${color(nombre)}[${nombre}]${reset} ${gray}WS abierto${reset}`);
      ws.send(JSON.stringify({ tipo: 'union', usuario: nombre }));
    });

    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      estado.recibidos.push(m);

      if (m.tipo === 'bienvenida') {
        estado.id = m.id;
        estado.total = m.total;
        console.log(
          `${color(nombre)}[${nombre}]${reset} ${gray}bienvenida${reset} ` +
            `id=${m.id.slice(0, 8)}… total=${m.total}`
        );
      } else if (m.tipo === 'sistema') {
        console.log(
          `${color(nombre)}[${nombre}]${reset} ${gray}sistema${reset} ` +
            `${m.texto}  (total=${m.total})`
        );
      } else if (m.tipo === 'mensaje') {
        const propio = m.id === estado.id;
        const tag = propio ? '\x1b[32m(propio)\x1b[0m' : '\x1b[33m(ajeno)\x1b[0m';
        console.log(
          `${color(nombre)}[${nombre}]${reset} mensaje ${tag} ` +
            `${m.usuario}: "${m.texto}" @${m.hora}`
        );
      }
    });

    ws.on('error', reject);
    ws.on('close', () => {
      console.log(`${color(nombre)}[${nombre}]${reset} ${gray}cerrado${reset}`);
    });

    // Esperar bienvenida antes de devolver el handle.
    const t = setTimeout(() => reject(new Error('timeout bienvenida')), 2000);
    const check = setInterval(() => {
      if (estado.id) {
        clearTimeout(t);
        clearInterval(check);
        resolve({ ws, estado, nombre });
      }
    }, 20);
  });
}

async function main() {
  console.log(`${gray}── escenario 1: dos pestañas se conectan ──${reset}`);
  const ana = await pestania('Ana');
  await sleep(80);
  const bruno = await pestania('Bruno');
  await sleep(120); // dejar que crucen los broadcasts

  console.log(`\n${gray}── escenario 2: cada una manda un mensaje ──${reset}`);
  ana.ws.send(JSON.stringify({ tipo: 'mensaje', texto: '¡Hola Bruno!' }));
  await sleep(80);
  bruno.ws.send(JSON.stringify({ tipo: 'mensaje', texto: 'Hola Ana, te leo.' }));
  await sleep(120);

  console.log(`\n${gray}── escenario 3: detección "propio vs ajeno" con nombres iguales ──${reset}`);
  const ana2 = await pestania('Ana'); // mismo nombre que ana
  await sleep(120);
  ana2.ws.send(JSON.stringify({ tipo: 'mensaje', texto: 'soy la segunda Ana' }));
  await sleep(120);

  console.log(`\n${gray}── escenario 4: validación (texto vacío, demasiado largo) ──${reset}`);
  ana.ws.send(JSON.stringify({ tipo: 'mensaje', texto: '   ' })); // ignorado
  await sleep(60);
  ana.ws.send(JSON.stringify({ tipo: 'mensaje', texto: 'A'.repeat(800) })); // truncado a 500
  await sleep(120);

  console.log(`\n${gray}── escenario 5: rate limit (3 mensajes en ráfaga) ──${reset}`);
  bruno.ws.send(JSON.stringify({ tipo: 'mensaje', texto: 'spam-1' }));
  bruno.ws.send(JSON.stringify({ tipo: 'mensaje', texto: 'spam-2' }));
  bruno.ws.send(JSON.stringify({ tipo: 'mensaje', texto: 'spam-3' }));
  await sleep(180);

  console.log(`\n${gray}── escenario 6: una pestaña se cierra → broadcast "salida" ──${reset}`);
  bruno.ws.close();
  await sleep(120);

  // Resumen
  console.log(`\n${gray}── resumen ──${reset}`);
  const mensajesAna = ana.estado.recibidos.filter((m) => m.tipo === 'mensaje');
  const propios = mensajesAna.filter((m) => m.id === ana.estado.id);
  const ajenos = mensajesAna.filter((m) => m.id !== ana.estado.id);
  const sistemasFinales = ana.estado.recibidos.filter((m) => m.tipo === 'sistema');
  const ultimoSistema = sistemasFinales[sistemasFinales.length - 1];

  console.log(`Ana ha recibido en total: ${ana.estado.recibidos.length} mensajes`);
  console.log(`  · mensajes propios:  ${propios.length}`);
  console.log(`  · mensajes ajenos:   ${ajenos.length}`);
  console.log(`  · último 'total' visto: ${ultimoSistema?.total}`);

  const truncados = mensajesAna.filter((m) => m.texto && m.texto.length === 500);
  console.log(`  · mensajes con texto truncado a 500: ${truncados.length}`);

  const spam = mensajesAna.filter((m) => /^spam-/.test(m.texto || ''));
  console.log(`  · mensajes 'spam-*' que pasaron el rate limit: ${spam.length}/3`);

  ana.ws.close();
  ana2.ws.close();
  await sleep(100);
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
