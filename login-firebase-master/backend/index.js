const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Almacenar todas las conexiones activas
const clients = new Set();

wss.on('connection', (ws) => {
    // Agregar el nuevo cliente
    clients.add(ws);
    console.log('Nuevo cliente conectado. Total de clientes:', clients.size);

    // Manejar mensajes entrantes
    ws.on('message', (message) => {
        console.log('Mensaje recibido:', message.toString());
        // Transmitir el mensaje a todos los clientes conectados
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                console.log('Enviando mensaje a otro cliente');
                client.send(message.toString());
            }
        });
    });

    // Manejar errores
    ws.on('error', (error) => {
        console.error('Error en la conexión WebSocket:', error);
    });

    // Manejar desconexión
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Cliente desconectado. Total de clientes:', clients.size);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Servidor WebSocket ejecutándose en el puerto ${PORT}`);
}); 