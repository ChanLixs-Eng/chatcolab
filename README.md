# 💬 ChatColab

Sistema de chat colaborativo en tiempo real usando **WebSocket nativo**.

> **Equipo:** Bit by Bit
> **Stack:** Node.js · Express · ws · HTML/CSS/JS vanilla

---

## ✨ Características

- 🔌 Conexión instantánea por WebSocket (sin polling).
- 👥 Múltiples usuarios conectados al mismo tiempo.
- 🟢 Notificaciones automáticas de conexión y desconexión.
- 🎨 Diseño dark mode neón (gradientes morado → rosa).
- 🆓 Nombre temporal automático si no escribes uno.
- ⏱ Hora local en cada mensaje.
- 📜 Historial visible con scroll automático.

---

## 📋 Requisitos previos

- **Node.js** 18 o superior
- **npm** (viene incluido con Node.js)
- Un navegador moderno (Chrome, Firefox, Safari, Edge)

Verifica que tienes Node instalado:

```bash
node --version
npm --version
```

---

## 🚀 Instalación

1. Clona o descarga este repositorio.
2. Entra a la carpeta del proyecto:

```bash
cd chatcolab
```

3. Instala las dependencias:

```bash
npm install
```

---

## ▶️ Ejecución

Levanta el servidor con:

```bash
npm start
```

Verás en la consola:

```
🚀 Servidor en http://localhost:3000
```

Abre tu navegador en **http://localhost:3000**.

> 💡 Para probar el chat con varios usuarios, abre dos o más pestañas/ventanas de navegador apuntando a la misma URL y pon nombres distintos.

---

## 🧪 Cómo probarlo

1. Abre **http://localhost:3000** en una pestaña → escribe "Juan" → conectar.
2. Abre **http://localhost:3000** en otra pestaña (o ventana de incógnito) → escribe "María" → conectar.
3. Empieza a chatear: los mensajes aparecen en tiempo real en ambas pestañas.
4. Cierra una pestaña: la otra verá `🔴 X ha salido`.
5. Deja el campo de nombre vacío en una nueva pestaña: serás `Usuario_473` (número aleatorio).

---

## 📁 Estructura del proyecto

```
chatcolab/
├── server.js              # Servidor Express + WebSocket
├── package.json           # Dependencias y scripts
├── .gitignore
├── README.md
├── ChatColab.md           # Especificaciones originales del proyecto
└── public/
    ├── index.html         # Interfaz del chat (login + chat)
    ├── style.css          # Estilos dark mode neón
    └── client.js          # Lógica WebSocket del cliente
```

---

## 🖼 Capturas de pantalla

### Pantalla de login

> _Espacio reservado para captura de la pantalla de bienvenida._

![Login](docs/login.png)

### Pantalla de chat

> _Espacio reservado para captura del chat con varios mensajes._

![Chat](docs/chat.png)

### Notificaciones de conexión/desconexión

> _Espacio reservado para captura mostrando los pills verde 🟢 y rojo 🔴._

![Notificaciones](docs/sistema.png)

---

## 🎨 Paleta de colores (dark mode neón)

| Token              | Hex        | Uso                       |
|--------------------|------------|---------------------------|
| `--bg-main`        | `#0a0a0f`  | Fondo principal           |
| `--bg-surface`     | `#13111c`  | Cards y superficies       |
| `--bg-input`       | `#1c1830`  | Inputs y burbujas ajenas  |
| Gradiente primario | `#8b5cf6` → `#ec4899` | Botones, mensajes propios |

---

## 🛠 Tecnologías

- [Express](https://expressjs.com/) — servir archivos estáticos.
- [ws](https://github.com/websockets/ws) — WebSocket nativo en Node.js.
- [Tabler Icons](https://tabler.io/icons) — iconos vía CDN.

---

## 👥 Equipo Bit by Bit

| # | Integrante                         | HU asignada                       |
|---|------------------------------------|-----------------------------------|
| 1 | Barrancos Juan Luis                | HU-01 — Conexión al chat          |
| 2 | Alba Zapata Cristhian              | HU-02 — Nombre automático         |
| 3 | Olivera Salazar Jose Maximiliano   | HU-03 — Servidor WebSocket        |
| 4 | Salvatierra Vargas Beymar          | HU-04 — Envío/recepción mensajes  |
| 5 | Mamani Olivera Jhaneth             | HU-05 — Historial visible         |
| 6 | Moscoso Pierola Monserrat          | HU-06 — Notificaciones conex.     |
| 7 | Mercado Mejia Dhery                | HU-07 — Documentación             |

---

## 🔗 Enlaces

- **Trello:** https://trello.com/b/Si63ej6F/chatcolab-sprint-1-bit-by-bit

---

## 📝 Licencia

Proyecto académico · libre para uso del equipo.
