// ============================================================
// ChatColab - Cliente WebSocket
// Equipo: Bit by Bit
// ============================================================
// Lógica del navegador: conecta al WebSocket, envía y recibe
// mensajes JSON, y los renderiza en la pantalla del chat.
// ============================================================

// ---------- Referencias al DOM ----------
const pantallaLogin = document.getElementById('pantalla-login');
const pantallaChat  = document.getElementById('pantalla-chat');

const inputNombre   = document.getElementById('input-nombre');
const btnConectar   = document.getElementById('btn-conectar');
const errorConexion = document.getElementById('error-conexion');

const pillNombreUsuario   = document.getElementById('pill-nombre-usuario');
const contadorConectados  = document.getElementById('contador-conectados');
const mensajesContenedor  = document.getElementById('mensajes');
const inputMensaje        = document.getElementById('input-mensaje');
const btnEnviar           = document.getElementById('btn-enviar');

// ---------- Estado ----------
let ws = null;           // instancia del WebSocket
let miNombre = '';        // nombre del usuario actual
let usuariosConectados = 0; // contador local (estimación basada en eventos)

// Paleta de gradientes únicos para avatares de otros usuarios
// (rosa→naranja, cyan→morado, etc.). Se asigna por hash del nombre.
const GRADIENTES_AVATAR = [
  'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  'linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
];

// ---------- Utilidades ----------

// Obtiene la hora actual en formato HH:MM
function horaActual() {
  const ahora = new Date();
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mm = String(ahora.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Devuelve un gradiente determinístico según el nombre del usuario.
// Permite que el mismo usuario tenga siempre el mismo color.
function gradientePorNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash + nombre.charCodeAt(i)) % GRADIENTES_AVATAR.length;
  }
  return GRADIENTES_AVATAR[hash];
}

// Devuelve las iniciales (1 o 2 letras) del nombre para el avatar
function iniciales(nombre) {
  const partes = nombre.trim().split(/[\s_]+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

// Hace scroll automático del contenedor de mensajes hacia abajo
function scrollAlFinal() {
  mensajesContenedor.scrollTop = mensajesContenedor.scrollHeight;
}

// Actualiza el subtítulo "X conectados"
function actualizarContador() {
  const n = Math.max(1, usuariosConectados);
  contadorConectados.textContent = `${n} conectado${n === 1 ? '' : 's'}`;
}

// ---------- Renderizado de mensajes ----------

// Mensaje de otro usuario (alineado a la izquierda con avatar)
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
  // Color del nombre: usar el inicio del gradiente (CSS no puede leerlo,
  // así que aplicamos el accent morado por simplicidad)
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

// Mensaje propio (alineado a la derecha, con gradiente y glow)
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

// Mensaje del sistema (pill verde para conexión, roja para desconexión)
function renderMensajeSistema({ texto, evento }) {
  const div = document.createElement('div');
  div.className = 'mensaje-sistema ' +
    (evento === 'salida' ? 'sistema-salida' : 'sistema-union');
  div.textContent = texto;
  mensajesContenedor.appendChild(div);
  scrollAlFinal();
}

// ---------- Conexión WebSocket ----------

function conectar() {
  // Determinar el nombre: si está vacío, generar Usuario_<100-999>
  const nombreInput = inputNombre.value.trim();
  miNombre = nombreInput || `Usuario_${Math.floor(Math.random() * 900) + 100}`;

  // Construir la URL del WebSocket dinámicamente (mismo host del HTML)
  const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocolo}//${window.location.host}`;

  // Limpiar mensaje de error anterior
  errorConexion.hidden = true;
  errorConexion.textContent = '';

  try {
    ws = new WebSocket(url);
  } catch (err) {
    mostrarError('No se pudo crear la conexión WebSocket.');
    return;
  }

  // Conexión exitosa: mandamos el handshake con el nombre y cambiamos de pantalla
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ tipo: 'union', usuario: miNombre }));

    // Cambiar de pantalla: ocultar login, mostrar chat
    pantallaLogin.hidden = true;
    pantallaChat.hidden = false;

    pillNombreUsuario.textContent = miNombre;
    actualizarContador();
    inputMensaje.focus();
  });

  // Mensaje recibido del servidor
  ws.addEventListener('message', (event) => {
    let datos;
    try {
      datos = JSON.parse(event.data);
    } catch {
      return;
    if (datos.tipo === 'contador') {
      usuariosConectados = datos.cantidad;
      actualizarContador();
      return;
    }

    if (datos.tipo === 'sistema') {
      // Mantener un contador local aproximado de usuarios conectados
      // Nota: El contador se actualiza vía mensajes 'contador' del servidor
      renderMensajeSistema(datos);
      return;
    }

    if (datos.tipo === 'mensaje') {
      // Distinguir mensaje propio vs ajeno por el nombre
      if (datos.usuario === miNombre) {
        renderMensajePropio(datos);
      } else {
        renderMensajeAjeno(datos);
      }
    }
  });

  // Error de conexión: mostrar al usuario
  ws.addEventListener('error', () => {
    mostrarError('Error al conectar con el servidor. Verifica que esté encendido.');
  });

  // Conexión cerrada inesperadamente
  ws.addEventListener('close', () => {
    if (!pantallaChat.hidden) {
      // Si estábamos chateando, mostrar pill de reconexión perdida
      renderMensajeSistema({
        texto: '🔴 Conexión perdida con el servidor',
        evento: 'salida'
      });
    }
  });
}

function mostrarError(texto) {
  errorConexion.textContent = texto;
  errorConexion.hidden = false;
}

// ---------- Envío de mensajes ----------

function enviarMensaje() {
  const texto = inputMensaje.value.trim();
  // No enviar mensajes vacíos (HU-04)
  if (!texto) return;
  // No enviar si la conexión no está abierta
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    tipo: 'mensaje',
    texto: texto,
    hora: horaActual()
  }));

  inputMensaje.value = '';
  inputMensaje.focus();
}

// ---------- Listeners de eventos UI ----------

// Botón conectar
btnConectar.addEventListener('click', conectar);

// Tecla Enter en el input de nombre = conectar
inputNombre.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') conectar();
});

// Botón enviar
btnEnviar.addEventListener('click', enviarMensaje);

// Tecla Enter en el input de mensaje = enviar
inputMensaje.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enviarMensaje();
});
