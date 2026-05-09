# 📋 ChatColab — Especificaciones del Proyecto

> **Archivo de contexto para Claude Code**
> Este archivo contiene TODAS las especificaciones para implementar el proyecto.
> Léelo completo antes de empezar a generar código.

---

## 🎯 OBJETIVO DEL PROYECTO

Implementar un **sistema de chat colaborativo en tiempo real** usando **WebSocket** que permita a múltiples usuarios comunicarse de forma instantánea desde un navegador web.

**Equipo:** Bit by Bit
**Stack obligatorio:** Node.js + Express + ws (WebSocket) + HTML/CSS/JS vanilla
**Restricción:** NO usar polling ni long-polling. Solo WebSocket nativo.
**Filosofía:** Mientras menos código, mejor. Simplicidad ante todo.
**Estética:** Dark mode con gradientes neón (morado → rosa), estilo moderno y llamativo.

---

## 📁 ESTRUCTURA DE ARCHIVOS A CREAR

```
chatcolab/
├── server.js              # Servidor Express + WebSocket
├── package.json           # Dependencias y scripts npm
├── .gitignore             # Ignorar node_modules
├── README.md              # Documentación de instalación
├── ChatColab.md           # (este archivo, ya existe)
└── public/
    ├── index.html         # Interfaz del chat (SPA)
    ├── style.css          # Estilos del chat (dark mode)
    └── client.js          # Lógica WebSocket del cliente
```

---

## 🛠 DEPENDENCIAS

Solo dos dependencias en `package.json`:

```json
{
  "name": "chatcolab",
  "version": "1.0.0",
  "description": "Sistema de chat colaborativo en tiempo real con WebSocket",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.0",
    "ws": "^8.16.0"
  }
}
```

---

# 📝 HISTORIAS DE USUARIO A IMPLEMENTAR

Las 7 HU siguientes son los **requisitos funcionales** del sistema. Cada criterio de aceptación es un test que debe pasar.

---

## HU-01 — Conexión al chat

**Como** usuario, **quiero** conectarme al chat desde mi navegador, **para** participar en la conversación.

### Criterios de aceptación
- [ ] Al abrir `http://localhost:3000`, se muestra una pantalla con campo de nombre y botón "Conectar".
- [ ] Al hacer clic en "Conectar", se establece la conexión WebSocket con `ws://localhost:3000`.
- [ ] Si la conexión falla, se muestra un mensaje de error visible al usuario.

### Implementación esperada
- Pantalla inicial con `<input>` de nombre + `<button>` de conectar.
- Al conectar, ocultar pantalla inicial y mostrar el chat.
- Manejar evento `onerror` del WebSocket para mostrar errores.

---

## HU-02 — Nombre de usuario automático

**Como** usuario que no escribe nombre, **quiero** que el sistema me asigne uno temporal, **para** entrar al chat sin pasos extra.

### Criterios de aceptación
- [ ] Si el campo de nombre está vacío al hacer clic en "Conectar", se asigna automáticamente `Usuario_<número>` (donde número es aleatorio entre 100 y 999).
- [ ] El nombre asignado aparece como remitente en los mensajes que envía.

### Implementación esperada
```js
const nombre = inputNombre.value.trim() || `Usuario_${Math.floor(Math.random() * 900) + 100}`;
```

---

## HU-03 — Servidor WebSocket multi-conexión

**Como** desarrollador, **quiero** que el servidor acepte múltiples conexiones simultáneas, **para** que varios usuarios chateen al mismo tiempo.

### Criterios de aceptación
- [ ] El servidor (`server.js`) acepta al menos 5 conexiones WebSocket simultáneas.
- [ ] Cada cliente se registra al conectarse y se elimina al desconectarse.
- [ ] El servidor imprime logs de conexión/desconexión en consola.

### Implementación esperada
- Usar la librería `ws` de Node.js.
- Mantener un `Set` o `Map` de clientes conectados.
- Combinar `express` (para servir archivos estáticos de `/public`) con `ws` en el mismo puerto (3000).

```js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clientes = new Set();

wss.on('connection', (ws) => {
  clientes.add(ws);
  console.log(`✅ Cliente conectado. Total: ${clientes.size}`);

  ws.on('close', () => {
    clientes.delete(ws);
    console.log(`❌ Cliente desconectado. Total: ${clientes.size}`);
  });
});

server.listen(3000, () => {
  console.log('🚀 Servidor en http://localhost:3000');
});
```

---

## HU-04 — Envío y recepción de mensajes

**Como** usuario conectado, **quiero** enviar mensajes y ver los de los demás en tiempo real, **para** mantener una conversación fluida.

### Criterios de aceptación
- [ ] Hay un campo de texto y un botón "Enviar". También se envía con tecla Enter.
- [ ] Los mensajes vacíos (solo espacios) no se envían.
- [ ] Los mensajes ajenos aparecen en menos de 1 segundo.
- [ ] Cada mensaje muestra: **nombre del remitente, texto, hora** (formato HH:MM).

### Formato del mensaje (JSON)
```json
{
  "tipo": "mensaje",
  "usuario": "Juan",
  "texto": "Hola equipo",
  "hora": "14:32"
}
```

### Implementación esperada
- En el cliente: enviar JSON por `ws.send(JSON.stringify({...}))`.
- En el servidor: recibir el mensaje y hacer **broadcast** a todos los clientes conectados.
- Diferenciar visualmente mensajes propios vs ajenos (alineación o color distinto).

---

## HU-05 — Historial de mensajes visible

**Como** usuario en el chat, **quiero** ver el historial de mensajes de la sesión, **para** seguir el contexto de la conversación.

### Criterios de aceptación
- [ ] Los mensajes se muestran en orden cronológico (más antiguos arriba, más nuevos abajo).
- [ ] El contenedor del historial hace scroll automático al recibir un mensaje nuevo.

### Implementación esperada
- Usar un `<div>` contenedor con `overflow-y: auto`.
- Después de cada mensaje añadido: `contenedor.scrollTop = contenedor.scrollHeight`.
- El historial vive solo en memoria (no es necesario persistir en BD).

---

## HU-06 — Notificaciones de conexión/desconexión

**Como** participante del chat, **quiero** ver cuando alguien entra o sale, **para** saber quién está activo.

### Criterios de aceptación
- [ ] Al conectarse un usuario nuevo, se muestra a TODOS: `🟢 X se ha unido`.
- [ ] Al desconectarse, se muestra: `🔴 X ha salido`.
- [ ] Los mensajes del sistema se distinguen visualmente de los normales (estilo cursiva, color verde/rojo, centrados, en formato pill).

### Formato del mensaje del sistema (JSON)
```json
{
  "tipo": "sistema",
  "texto": "🟢 Juan se ha unido"
}
```

### Implementación esperada
- En el handshake inicial, el cliente envía su nombre al servidor.
- El servidor difunde `{tipo: "sistema", texto: "🟢 X se ha unido"}` al resto.
- En el evento `close`, el servidor difunde `{tipo: "sistema", texto: "🔴 X ha salido"}`.
- En el cliente, los mensajes con `tipo: "sistema"` se renderizan con clase CSS distinta (pill verde para entrada, pill rojo para salida).

---

## HU-07 — Documentación e instalación

**Como** integrante del equipo, **quiero** un README con instrucciones claras, **para** que cualquier persona pueda instalar y ejecutar el proyecto.

### Criterios de aceptación
- [ ] El `README.md` incluye: requisitos previos, comandos de instalación (`npm install`) y ejecución (`npm start`).
- [ ] El código está comentado en sus partes clave (al menos en `server.js` y `client.js`).
- [ ] Espacios para capturas de pantalla incluidos en el README.

---

# 🎨 ESPECIFICACIONES DE UI — DARK MODE NEÓN

El diseño es **dark mode estilo cyberpunk/moderno** con gradientes neón morado→rosa. Debe sentirse premium y llamativo.

## 🎨 Paleta de colores (USAR EXACTAMENTE)

```css
/* Fondos */
--bg-main: #0a0a0f;          /* fondo principal (casi negro) */
--bg-surface: #13111c;        /* surfaces y cards */
--bg-input: #1c1830;          /* inputs y burbujas ajenas */

/* Bordes */
--border-soft: #2a1f4a;
--border-strong: #3b2966;

/* Gradiente principal (botones, mensajes propios, avatares) */
--gradient-primary: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);

/* Gradiente del header */
--gradient-header: linear-gradient(90deg, #1e1b3a 0%, #2d1b4e 100%);

/* Texto */
--text-primary: #ffffff;
--text-body: #e4e4f0;
--text-secondary: #8b8aa3;
--text-tertiary: #6b6985;
--text-accent: #a78bfa;        /* morado claro para acentos */

/* Estados */
--green-online: #22c55e;
--green-soft: #4ade80;
--red-offline: #f87171;
--cyan-accent: #06b6d4;
--pink-accent: #ec4899;
--orange-accent: #f97316;
```

## 📐 Pantalla 1 — Login

**Estructura:**
- Card centrada de máximo 380px de ancho
- Fondo `#13111c`, borde `1px solid #2a1f4a`, border-radius 12px
- Box-shadow externo: `0 0 40px rgba(139, 92, 246, 0.15)` (glow sutil)

**Header del card:**
- Background con gradient `--gradient-header`
- Padding 14px 18px
- Ícono `ti-message-circle-bolt` color `#a78bfa`
- Texto "ChatColab" en blanco, font-weight 500
- Badge "BIT BY BIT" a la derecha:
  - Background: `rgba(167, 139, 250, 0.15)`
  - Color texto: `#a78bfa`
  - Font-size: 10px
  - Border-radius: 999px
  - Padding: 3px 8px

**Cuerpo del card:**
- Padding 2.25rem 1.5rem
- Texto centrado
- Avatar circular de 64px con gradient `--gradient-primary`, ícono `ti-bolt` blanco, box-shadow glow morado
- Título "Bienvenido al chat" 18px font-weight 500
- Subtítulo "Conéctate y empieza a colaborar" en `#8b8aa3` 13px
- Input nombre: bg `#1c1830`, border `1px solid #3b2966`, color blanco, padding 10px 14px, border-radius 10px
- Botón "Conectar": background `--gradient-primary`, sin borde, padding 12px, border-radius 10px, font-weight 500, box-shadow glow morado, ícono `ti-plug-connected`
- Hint en gris: "Sin nombre serás `Usuario_473`" (con el código en pill morado)

## 📐 Pantalla 2 — Chat

**Estructura:**
- Card de máximo 480px de ancho
- Mismo estilo de borde y glow que la pantalla de login

**Header:**
- Background con gradient `--gradient-header`
- Padding 12px 18px
- Lado izquierdo: ícono `ti-message-circle-bolt` morado claro + "ChatColab" blanco + subtítulo "3 conectados" en gris
- Lado derecho: pill verde con punto pulsante:
  - Background: `rgba(34, 197, 94, 0.15)`
  - Border: `1px solid rgba(34, 197, 94, 0.3)`
  - Padding: 4px 10px
  - Border-radius: 999px
  - Punto verde 8x8px con `box-shadow: 0 0 10px #22c55e`
  - Nombre del usuario en `#4ade80`

**Área de mensajes:**
- Background `#0a0a0f`
- Padding 18px
- Min-height 320px
- Background-image con dos radial-gradients sutiles para dar atmósfera:
  ```css
  background-image:
    radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.08) 0%, transparent 40%);
  ```
- Display flex column, gap 12px
- Overflow-y auto + scroll automático

**Mensajes ajenos (izquierda):**
- Align-self flex-start, max-width 75%
- Avatar circular 32px con gradient único por usuario (ej. rosa→naranja, cyan→morado)
- Iniciales del nombre en blanco font-weight 500
- Burbuja:
  - Background: `#1c1830`
  - Color texto: `#e4e4f0`
  - Padding: 9px 13px
  - Border-radius: `14px 14px 14px 2px` (esquina inferior izquierda casi recta)
  - Border: `1px solid #2a1f4a`
- Nombre del remitente arriba en color del avatar, font-size 11px
- Hora abajo en `#6b6985` 10px

**Mensajes propios (derecha):**
- Align-self flex-end, max-width 75%
- Sin avatar
- Burbuja:
  - Background: `--gradient-primary`
  - Color texto: blanco
  - Padding: 9px 13px
  - Border-radius: `14px 14px 2px 14px` (esquina inferior derecha casi recta)
  - Box-shadow: `0 0 15px rgba(139, 92, 246, 0.3)` (glow)
- Nombre + hora abajo a la derecha en `#6b6985` 10px

**Mensajes del sistema (centro):**
- Pill centrada con borde sutil
- Padding: 4px 12px
- Border-radius: 999px
- Font-style italic, font-size 11px

  Para conexión 🟢:
  ```css
  color: #4ade80;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  ```

  Para desconexión 🔴:
  ```css
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  ```

**Input de mensaje (footer):**
- Padding 12px
- Background `#13111c`
- Border-top `1px solid #2a1f4a`
- Display flex, gap 8px, align-items center
- Input:
  - Flex 1
  - Background `#1c1830`
  - Border `1px solid #3b2966`
  - Color blanco
  - Padding 10px 14px
  - Border-radius 999px (pill)
  - Placeholder "Escribe tu mensaje..."
- Botón enviar:
  - Circular 40x40px
  - Background `--gradient-primary`
  - Sin borde
  - Box-shadow glow morado
  - Ícono `ti-send` blanco 18px

## 🔤 Tipografía

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

- Títulos: 18px, font-weight 500
- Texto cuerpo: 14px, font-weight 400
- Etiquetas: 11-12px

## 🌐 Iconos

Usar **Tabler Icons** vía CDN. Agregar en el `<head>` del HTML:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
```

Iconos a usar:
- `ti-message-circle-bolt` → logo del chat
- `ti-bolt` → en el avatar de bienvenida
- `ti-plug-connected` → botón conectar
- `ti-send` → botón enviar

---

# ✅ CRITERIOS GLOBALES DE ACEPTACIÓN

Antes de considerar el proyecto terminado, verificar:

1. ✅ `npm install && npm start` arranca el servidor sin errores.
2. ✅ Abrir 2 pestañas en `http://localhost:3000` permite chatear entre ellas en tiempo real.
3. ✅ Al cerrar una pestaña, la otra ve el mensaje "🔴 X ha salido".
4. ✅ El usuario sin nombre recibe un nombre tipo `Usuario_473`.
5. ✅ Los mensajes vacíos no se envían.
6. ✅ El historial hace scroll automático.
7. ✅ El diseño respeta el dark mode con gradientes neón especificados.
8. ✅ El código está comentado en las partes clave.

---

# 🚀 ORDEN DE IMPLEMENTACIÓN SUGERIDO

Para Claude Code, implementa en este orden:

1. **`package.json`** — define dependencias y scripts.
2. **`.gitignore`** — ignora `node_modules`.
3. **`server.js`** — servidor mínimo con Express + WebSocket que difunde mensajes.
4. **`public/index.html`** — estructura HTML con pantalla login + pantalla chat (Tabler Icons en el head).
5. **`public/style.css`** — estilos dark mode con gradientes neón, siguiendo paleta exacta.
6. **`public/client.js`** — lógica WebSocket del cliente.
7. **`README.md`** — instrucciones de instalación y uso.

---

# 📌 RESTRICCIONES Y BUENAS PRÁCTICAS

- ❌ **NO usar** Socket.IO (usar la librería `ws` de WebSocket nativo).
- ❌ **NO usar** frameworks de frontend (React, Vue, etc.). Solo HTML/CSS/JS vanilla.
- ❌ **NO usar** base de datos. El historial vive en memoria de cada cliente.
- ❌ **NO implementar** autenticación con OAuth (Google/Facebook). Solo nombre temporal.
- ❌ **NO usar** modo claro. Solo dark mode con la paleta especificada.
- ✅ **SÍ comentar** las partes clave del código (en español).
- ✅ **SÍ mantener** el código simple y legible.
- ✅ **SÍ usar** los gradientes y glows especificados — son parte de la identidad visual.
- ✅ **SÍ probar** con múltiples pestañas antes de dar por terminado.

---

# 👥 EQUIPO

| # | Integrante | HU asignada |
|---|------------|-------------|
| 1 | Barrancos Juan Luis | HU-01 — Conexión al chat |
| 2 | Alba Zapata Cristhian | HU-02 — Nombre automático |
| 3 | Olivera Salazar Jose Maximiliano | HU-03 — Servidor WebSocket |
| 4 | Salvatierra Vargas Beymar | HU-04 — Envío/recepción mensajes |
| 5 | Mamani Olivera Jhaneth | HU-05 — Historial visible |
| 6 | Moscoso Pierola Monserrat | HU-06 — Notificaciones conex/desconex |
| 7 | Mercado Mejia Dhery | HU-07 — Documentación |

---

# 🔗 ENLACES DEL PROYECTO

- **Tablero Trello:** https://trello.com/b/Si63ej6F/chatcolab-sprint-1-bit-by-bit
- **Repositorio Git:** _(pendiente de crear)_

---

> 💡 **Instrucción para Claude Code:**
> Implementa los archivos en el orden sugerido. Mantén el código simple, comentado en español. Respeta ESTRICTAMENTE la paleta de colores y los detalles del diseño dark mode neón (gradientes morado→rosa, glows, avatares con gradientes únicos, pills para mensajes del sistema). El resultado debe verse premium y llamativo, no genérico. Asegúrate de que el sistema completo se pueda probar con `npm install && npm start` abriendo dos pestañas del navegador.