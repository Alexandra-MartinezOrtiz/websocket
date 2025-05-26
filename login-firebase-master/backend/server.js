import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

// Cargar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const wsPort = process.env.WS_PORT || 8081;

// Configurar CORS con origen específico
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para parsear JSON
app.use(express.json());

// Inicializar Firebase Admin
const firebaseConfig = {
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Middleware para validar token
const validateToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Error validating token:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Endpoint para registro de usuarios
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const userRecord = await auth.createUser({
            email,
            password,
            emailVerified: false
        });
        res.json({ uid: userRecord.uid, email: userRecord.email });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(400).json({ error: error.message });
    }
});

// Endpoint para inicio de sesión
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Llamar al endpoint de Firebase Auth para validar credenciales
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(401).json({
                error: data.error?.message || 'Credenciales inválidas'
            });
        }



        res.json({
            token: data.idToken,
            uid: data.localId,
            email: data.email
        });

    } catch (error) {
        console.error('Error al autenticar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Endpoint para verificar token
app.post('/api/verify-token', validateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Endpoint para obtener usuario aleatorio
app.get('/api/random-user', async (req, res) => {
    try {
        const response = await fetch(process.env.RANDOM_USER_API);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching random user:', error);
        res.status(500).json({ error: 'Error fetching random user' });
    }
});

// Crear servidor WebSocket
const wss = new WebSocketServer({ port: wsPort });

// Validar origen de WebSocket
wss.on('connection', async (ws, req) => {
    const origin = req.headers.origin;
    if (!process.env.ALLOWED_ORIGINS.split(',').includes(origin)) {
        console.log('Conexión rechazada: Origen no permitido', origin);
        ws.close(1008, 'Origin not allowed');
        return;
    }

    // Validar token de autenticación
    const token = req.url.split('token=')[1];
    if (!token) {
        console.log('Conexión rechazada: No token provided');
        ws.close(1008, 'No token provided');
        return;
    }

    try {
        const decodedToken = await auth.verifyIdToken(token);
        ws.user = decodedToken;
        console.log('Usuario conectado:', decodedToken.email);

        // Enviar mensajes anteriores
        const messagesRef = db.collection('messages');
        const snapshot = await messagesRef.orderBy('timestamp', 'desc').limit(50).get();
        const messages = [];
        snapshot.forEach(doc => {
            messages.unshift(doc.data());
        });
        ws.send(JSON.stringify({ type: 'history', messages }));

        ws.on('message', async (message) => {
            try {
                const messageData = {
                    text: message.toString(),
                    userId: decodedToken.uid,
                    userName: decodedToken.email,
                    timestamp: new Date()
                };

                // Guardar mensaje en Firestore
                const docRef = await db.collection('messages').add(messageData);
                messageData.id = docRef.id;

                // Convertir el timestamp a un formato que el cliente pueda manejar
                const clientMessage = {
                    ...messageData,
                    timestamp: {
                        _seconds: Math.floor(messageData.timestamp.getTime() / 1000),
                        _nanoseconds: messageData.timestamp.getMilliseconds() * 1000000
                    }
                };

                // Broadcast del mensaje a todos los clientes conectados
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'message',
                            ...clientMessage
                        }));
                    }
                });
            } catch (error) {
                console.error('Error processing message:', error);
                ws.send(JSON.stringify({ 
                    type: 'error',
                    error: 'Error processing message'
                }));
            }
        });

        ws.on('close', () => {
            console.log('Usuario desconectado:', decodedToken.email);
        });

    } catch (error) {
        console.error('Error validating token:', error);
        ws.close(1008, 'Invalid token');
    }
});

// Iniciar servidor HTTP
app.listen(port, () => {
    console.log(`HTTP Server running on port ${port}`);
    console.log(`WebSocket Server running on port ${wsPort}`);
    console.log(`Allowed origins: ${process.env.ALLOWED_ORIGINS}`);
}); 