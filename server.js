#!/usr/bin/env node
/**
 * MikroTik Dashboard - Servidor Principal
 * Node.js + Express + Socket.IO + EJS
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const routes = require('./routes');
const MikroTikController = require('./controller');

// ==================== CONFIGURACIÓN ====================

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Sesiones simples en memoria (no productivo, como pidió sin DB)
app.use(session({
    secret: process.env.SESSION_SECRET || 'mikrotik-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================== CONTROLADOR ====================

const mikrotikController = new MikroTikController(io);

// ==================== RUTAS ====================

routes(app, mikrotikController);

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
    console.log('✅ Cliente conectado via WebSocket:', socket.id);
    
    socket.emit('connected', { 
        message: 'Conectado al servidor',
        timestamp: new Date().toISOString()
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
    
    // Evento para conectar al MikroTik
    socket.on('connect_mikrotik', async () => {
        try {
            const result = await mikrotikController.connect();
            socket.emit('connection_status', result);
        } catch (error) {
            socket.emit('connection_status', { 
                success: false, 
                message: error.message 
            });
        }
    });
    
    // Evento para desconectar
    socket.on('disconnect_mikrotik', () => {
        mikrotikController.disconnect();
        socket.emit('connection_status', { 
            success: true, 
            message: 'Desconectado' 
        });
    });
});

// ==================== MANEJO DE ERRORES ====================

app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor' 
    });
});

// 404 - Ruta no encontrada
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Página no encontrada' 
    });
});

// ==================== ARRANQUE DEL SERVIDOR ====================

server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 MikroTik Dashboard - Node.js');
    console.log('='.repeat(60));
    console.log(`📡 Servidor HTTP: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('⚙️  Presiona CTRL+C para detener el servidor');
    console.log('='.repeat(60));
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
    console.log('\n⏹️  Deteniendo servidor...');
    mikrotikController.disconnect();
    server.close(() => {
        console.log('✅ Servidor detenido correctamente');
        process.exit(0);
    });
});

module.exports = { app, server, io };
