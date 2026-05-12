const express = require('express')
const http = require('http')
const { WebSocketServer } = require('ws')
const { randomUUID } = require('node:crypto')

// Límites y rate limit para evitar abuso desde clientes WS arbitrarios.
const MAX_USUARIO = 20
const MAX_TEXTO = 500
const RATE_LIMIT_MS = 50 // máximo 1 mensaje cada 50 ms por cliente

const app = express()
app.use(express.static('public'))

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

const clientes = new Set()

const historial = [] // array de los últimos 50 mensajes en memoria
const MAX_HISTORIAL = 50

function broadcast(objeto) {
  const mensaje = JSON.stringify(objeto)
  for (const cliente of clientes) {
    if (cliente.readyState === 1) cliente.send(mensaje)
  }
}

function sanitizarUsuario(u) {
  if (typeof u !== 'string') return null
  const t = u.trim().slice(0, MAX_USUARIO)
  return t || null
}

function sanitizarTexto(t) {
  if (typeof t !== 'string') return null
  const limpio = t.trim().slice(0, MAX_TEXTO)
  return limpio || null
}

function horaServidor() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Total de usuarios "presentes" = los que completaron handshake con un nombre.
function contarPresentes() {
  let n = 0
  for (const c of clientes) if (c.usuario) n++
  return n
}

wss.on('connection', (ws) => {
  // Identidad estable por conexión: permite al cliente distinguir mensajes
  // propios sin depender del nombre (que puede repetirse).
  ws.id = randomUUID()
  ws.usuario = null
  ws.ultimoMsg = 0

  clientes.add(ws)
  console.log(`✅ Cliente conectado. Total: ${clientes.size}`)

  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }

    if (msg.tipo === 'union') {
      const nombre = sanitizarUsuario(msg.usuario)
      if (!nombre) return
      ws.usuario = nombre

      // Unicast: el cliente recibe su id y el conteo actual para sincronizar.
      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            tipo: 'bienvenida',
            id: ws.id,
            usuario: nombre,
            total: contarPresentes(),
            historial: historial
          })
        )
      }

      broadcast({
        tipo: 'sistema',
        evento: 'union',
        texto: `🟢 ${nombre} se ha unido`,
        total: contarPresentes()
      })
      return
    }

    if (msg.tipo === 'mensaje') {
      const ahora = Date.now()
      if (ahora - ws.ultimoMsg < RATE_LIMIT_MS) return

      const texto = sanitizarTexto(msg.texto)
      if (!texto) return

      ws.ultimoMsg = ahora

      // Guardar mensaje en historial
      const paqueteMensaje = {
        tipo: 'mensaje',
        id: ws.id,
        usuario: ws.usuario || 'Anónimo',
        texto,
        hora: horaServidor()
      }

      historial.push(paqueteMensaje)

      // Mantener solo los últimos 50 mensajes
      if (historial.length > MAX_HISTORIAL) {
        historial.shift()
      }

      // Enviar mensaje a todos
      broadcast(paqueteMensaje)
    }
  })

  ws.on('close', () => {
    clientes.delete(ws)
    console.log(`❌ Cliente desconectado. Total: ${clientes.size}`)

    if (ws.usuario) {
      broadcast({
        tipo: 'sistema',
        evento: 'salida',
        texto: `🔴 ${ws.usuario} ha salido`,
        total: contarPresentes()
      })
    }
  })

  ws.on('error', (err) => {
    console.error('Error en socket:', err.message)
  })
})

const PORT = process.env.PORT || 3000
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`)
  })
}

module.exports = { app, server, wss, clientes, broadcast, historial, MAX_HISTORIAL }
