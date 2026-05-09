// ============================================================
// ChatColab - Servidor Express + WebSocket
// Equipo: Bit by Bit
// ============================================================
// Servidor mínimo que sirve archivos estáticos desde /public
// y mantiene un servidor WebSocket en el mismo puerto 3000.
// Hace broadcast de los mensajes a todos los clientes conectados.
// ============================================================

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

// Crear app Express y servir la carpeta /public
const app = express();
app.use(express.static('public'));

// Servidor HTTP que comparten Express y WebSocket
const server = http.createServer(app);

// Servidor WebSocket montado sobre el mismo HTTP server
const wss = new WebSocketServer({ server });

// Conjunto de clientes conectados (cada ws guarda su nombre en ws.usuario)
const clientes = new Set();

// Función auxiliar: enviar un objeto JSON a TODOS los clientes conectados
function broadcast(objeto) {
  const mensaje = JSON.stringify(objeto);
  for (const cliente of clientes) {
    // readyState === 1 significa OPEN (conexión activa)
    if (cliente.readyState === 1) {
      cliente.send(mensaje);
    }
  }
}

// Manejar nuevas conexiones WebSocket
wss.on('connection', (ws) => {
  // Registrar cliente en el conjunto
  clientes.add(ws);
  console.log(`✅ Cliente conectado. Total: ${clientes.size}`);

  // Manejar mensajes recibidos del cliente
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      // Si llega algo que no es JSON válido, lo ignoramos
      return;
    }

    // Handshake inicial: el cliente envía su nombre al conectarse
    if (msg.tipo === 'union') {
      ws.usuario = msg.usuario;
      // Notificar a todos que un usuario se unió
      broadcast({
        tipo: 'sistema',
        evento: 'union',
        texto: `🟢 ${ws.usuario} se ha unido`
      });
      return;
    }

    // Mensaje normal del chat: hacer broadcast a todos
    if (msg.tipo === 'mensaje' && msg.texto && msg.texto.trim()) {
      broadcast({
        tipo: 'mensaje',
        usuario: ws.usuario || 'Anónimo',
        texto: msg.texto.trim(),
        hora: msg.hora
      });
    }
  });

  // Cuando un cliente se desconecta
  ws.on('close', () => {
    clientes.delete(ws);
    console.log(`❌ Cliente desconectado. Total: ${clientes.size}`);

    // Si el usuario alcanzó a registrarse con nombre, avisar a los demás
    if (ws.usuario) {
      broadcast({
        tipo: 'sistema',
        evento: 'salida',
        texto: `🔴 ${ws.usuario} ha salido`
      });
    }
  });

  // Manejar errores del socket sin crashear el servidor
  ws.on('error', (err) => {
    console.error('Error en socket:', err.message);
  });
});

// Arrancar servidor en puerto 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
