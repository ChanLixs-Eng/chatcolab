// ============================================================
// ChatColab - Cliente WebSocket
// Equipo: Bit by Bit
// ============================================================
// Conecta al WebSocket, envía y recibe mensajes JSON, y los
// renderiza en la pantalla del chat. La identidad del usuario
// la fija el servidor mediante un `id` único enviado en la
// "bienvenida"; eso permite distinguir mensajes propios incluso
// si dos usuarios eligen el mismo nombre.
// ============================================================

const pantallaLogin = document.getElementById('pantalla-login');
const pantallaChat  = document.getElementById('pantalla-chat');

const inputNombre   = document.getElementById('input-nombre');
const btnConectar   = document.getElementById('btn-conectar');
const errorConexion = document.getElementById('error-conexion');
const pillCodigo    = document.querySelector('.pill-codigo');

const pillNombreUsuario   = document.getElementById('pill-nombre-usuario');
const contadorConectados  = document.getElementById('contador-conectados');
const mensajesContenedor  = document.getElementById('mensajes');
const inputMensaje        = document.getElementById('input-mensaje');
const btnEnviar           = document.getElementById('btn-enviar');

let ws = null;
let miId = null;                 // asignado por el server en "bienvenida"
let miNombre = '';
let usuariosConectados = 0;
let conectando = false;          // guard contra doble conexión
let intentoReconexion = 0;       // exponente del backoff
let reconexionTimer = null;

const RECONEXION_BASE_MS = 500;
const RECONEXION_MAX_MS = 8000;

// Paleta de gradientes únicos para avatares de otros usuarios.
const GRADIENTES_AVATAR = [
  'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  'linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
];

// ---------- Utilidades ----------

function nombreAleatorio() {
  return `Usuario_${Math.floor(Math.random() * 900) + 100}`;
}

function gradientePorNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash + nombre.charCodeAt(i)) % GRADIENTES_AVATAR.length;
  }
  return GRADIENTES_AVATAR[hash];
}

function iniciales(nombre) {
  const partes = nombre.trim().split(/[\s_]+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function scrollAlFinal() {
  mensajesContenedor.scrollTop = mensajesContenedor.scrollHeight;
}

function actualizarContador() {
  const n = Math.max(0, usuariosConectados);
  contadorConectados.textContent = `${n} conectado${n === 1 ? '' : 's'}`;
}

function habilitarEnvio(activar) {
  inputMensaje.disabled = !activar;
  btnEnviar.disabled = !activar;
}

// ---------- Renderizado ----------

function renderMensajeAjeno({ usuario, texto, hora }) {
  const wrap = document.createElement('div');
  wrap.className = 'mensaje-ajeno';

  const avatar = document.createElement('div');
  avatar.className = 'avatar-usuario';
  avatar.style.background = gradientePorNombre(usuario);
  avatar.textContent = iniciales(usuario);

  const contenido = document.createElement('div');
  contenido.className = 'burbuja-contenido';

  const nombre = document.createElement('span');
  nombre.className = 'nombre-remitente';
  nombre.style.color = '#a78bfa';
  nombre.textContent = usuario;

  const burbuja = document.createElement('div');
  burbuja.className = 'burbuja-ajena';
  burbuja.textContent = texto;

  const horaSpan = document.createElement('span');
  horaSpan.className = 'hora-ajena';
  horaSpan.textContent = hora;

  contenido.appendChild(nombre);
  contenido.appendChild(burbuja);
  contenido.appendChild(horaSpan);

  wrap.appendChild(avatar);
  wrap.appendChild(contenido);

  mensajesContenedor.appendChild(wrap);
  scrollAlFinal();
}

function renderMensajePropio({ usuario, texto, hora }) {
  const wrap = document.createElement('div');
  wrap.className = 'mensaje-propio';

  const burbuja = document.createElement('div');
  burbuja.className = 'burbuja-propia';
  burbuja.textContent = texto;

  const meta = document.createElement('span');
  meta.className = 'meta-propia';
  meta.textContent = `${usuario} · ${hora}`;

  wrap.appendChild(burbuja);
  wrap.appendChild(meta);

  mensajesContenedor.appendChild(wrap);
  scrollAlFinal();
}

function renderMensajeSistema({ texto, evento }) {
  const div = document.createElement('div');
  // Default neutro: si llega un evento desconocido no asumimos color de union.
  let claseEvento = '';
  if (evento === 'salida') claseEvento = 'sistema-salida';
  else if (evento === 'union') claseEvento = 'sistema-union';
  div.className = `mensaje-sistema ${claseEvento}`.trim();
  div.textContent = texto;
  mensajesContenedor.appendChild(div);
  scrollAlFinal();
}

// ---------- Conexión ----------

function conectar() {
  if (conectando) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  conectando = true;
  btnConectar.disabled = true;

  // Si venimos de una reconexión, miNombre ya está fijado; en login lo leemos.
  if (!miNombre) {
    miNombre = inputNombre.value.trim() || nombreAleatorio();
  }

  const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocolo}//${window.location.host}`;

  errorConexion.hidden = true;
  errorConexion.textContent = '';

  try {
    ws = new WebSocket(url);
  } catch {
    conectando = false;
    btnConectar.disabled = false;
    mostrarError('No se pudo crear la conexión WebSocket.');
    return;
  }

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ tipo: 'union', usuario: miNombre }));
  });

  ws.addEventListener('message', (event) => {
    let datos;
    try {
      datos = JSON.parse(event.data);
    } catch {
      return;
    }
    if (datos.tipo === 'bienvenida') {
      miId = datos.id;
      conectando = false;
      btnConectar.disabled = false;
      intentoReconexion = 0;

      if (pantallaLogin.hidden === false) {
        pantallaLogin.hidden = true;
        pantallaChat.hidden = false;
      }
      pillNombreUsuario.textContent = miNombre;
      usuariosConectados = typeof datos.total === 'number' ? datos.total : 1;
      actualizarContador();
      habilitarEnvio(true);
      inputMensaje.focus();
      return;
    }

    if (datos.tipo === 'sistema') {
      if (typeof datos.total === 'number') {
        usuariosConectados = datos.total;
        actualizarContador();
      }
      renderMensajeSistema(datos);
      return;
    }

    if (datos.tipo === 'mensaje') {
      if (datos.id && datos.id === miId) {
        renderMensajePropio(datos);
      } else {
        renderMensajeAjeno(datos);
      }
    }
  });

  ws.addEventListener('error', () => {
    if (pantallaChat.hidden) {
      // Aún en login: el usuario puede leer el error allí.
      mostrarError('Error al conectar con el servidor. Verifica que esté encendido.');
    }
    // En chat el aviso lo da el handler de 'close' (más fiable).
  });

  ws.addEventListener('close', () => {
    const estabaEnChat = !pantallaChat.hidden;
    conectando = false;
    btnConectar.disabled = false;
    habilitarEnvio(false);

    if (estabaEnChat) {
      renderMensajeSistema({
        texto: '🔴 Conexión perdida. Reconectando…',
        evento: 'salida'
      });
      programarReconexion();
    }
  });
}

function programarReconexion() {
  if (reconexionTimer) clearTimeout(reconexionTimer);
  const delay = Math.min(
    RECONEXION_MAX_MS,
    RECONEXION_BASE_MS * 2 ** intentoReconexion
  );
  intentoReconexion++;
  reconexionTimer = setTimeout(() => {
    reconexionTimer = null;
    conectar();
  }, delay);
}

function mostrarError(texto) {
  errorConexion.textContent = texto;
  errorConexion.hidden = false;
}

// ---------- Envio de mensajes ----------

function enviarMensaje() {
  const texto = inputMensaje.value.trim();
  if (!texto) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({ tipo: 'mensaje', texto }));
  inputMensaje.value = '';
  inputMensaje.focus();
}

// ---------- Listeners ----------

btnConectar.addEventListener('click', conectar);

inputNombre.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') conectar();
});

btnEnviar.addEventListener('click', enviarMensaje);

inputMensaje.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enviarMensaje();
});

// Estado inicial: input de mensaje deshabilitado hasta que haya bienvenida.
habilitarEnvio(false);

// Hint dinámico: que el ejemplo "Usuario_XXX" coincida con lo que se generará.
if (pillCodigo) pillCodigo.textContent = nombreAleatorio();
