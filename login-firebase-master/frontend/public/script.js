const API_URL = 'http://localhost:8080/api';
const WS_URL = 'ws://localhost:8081';

let ws = null;
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const logoutButton = document.getElementById('logout-button');

let currentUser = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Verificar autenticación
const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/verify-token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Token inválido');
        }

        const data = await response.json();
        if (!data.valid) {
            throw new Error('Token inválido');
        }

        currentUser = {
            uid: localStorage.getItem('uid'),
            email: localStorage.getItem('email')
        };

        connectWebSocket(token);
    } catch (error) {
        console.error('Error verifying token:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('uid');
        localStorage.removeItem('email');
        window.location.href = 'login.html';
    }
};

// Conectar WebSocket
const connectWebSocket = (token) => {
    if (ws) {
        ws.close();
    }

    ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
        console.log('Conexión WebSocket establecida');
        displaySystemMessage('Conectado al chat');
        reconnectAttempts = 0;
    };

    ws.onclose = (event) => {
        console.log('Conexión WebSocket cerrada:', event.code, event.reason);
        displaySystemMessage('Desconectado del chat');

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            displaySystemMessage(`Intentando reconectar en ${delay/1000} segundos...`);
            setTimeout(() => connectWebSocket(token), delay);
        } else {
            displaySystemMessage('No se pudo reconectar al chat. Por favor, recarga la página.');
        }
    };

    ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        displaySystemMessage('Error en la conexión del chat');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Mensaje recibido:', data);

            switch (data.type) {
                case 'history':
                    displayMessages(data.messages);
                    break;
                case 'message':
                    displayMessage(data);
                    break;
                case 'error':
                    displaySystemMessage(data.error);
                    break;
                default:
                    console.warn('Tipo de mensaje desconocido:', data.type);
            }
        } catch (error) {
            console.error('Error al procesar mensaje:', error);
            displaySystemMessage('Error al procesar mensaje');
        }
    };
};

// Mostrar mensajes
const displayMessages = (messages) => {
    if (!Array.isArray(messages)) {
        console.error('Mensajes no es un array:', messages);
        return;
    }

    chatMessages.innerHTML = '';
    messages.forEach(message => {
        if (message && typeof message === 'object') {
            displayMessage(message);
        }
    });
};

const displayMessage = (message) => {
    if (!message || !message.text) {
        console.error('Mensaje inválido:', message);
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.userId === currentUser.uid ? 'own-message' : ''}`;
    
    let timestamp;
    try {
        if (message.timestamp?._seconds) {
            // Timestamp de Firestore
            const date = new Date(message.timestamp._seconds * 1000);
            timestamp = date.toLocaleTimeString();
        } else if (message.timestamp instanceof Date) {
            timestamp = message.timestamp.toLocaleTimeString();
        } else if (typeof message.timestamp === 'string') {
            timestamp = new Date(message.timestamp).toLocaleTimeString();
        } else if (message.timestamp?.toDate) {
            timestamp = message.timestamp.toDate().toLocaleTimeString();
        } else {
            timestamp = 'Ahora';
        }
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        timestamp = 'Ahora';
    }
    
    const userName = message.userName || 'Usuario';
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="user-name">${userName}</span>
        </div>
        <div class="message-content">
            ${message.text}
            <span class="timestamp">${timestamp}</span>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
};

const displaySystemMessage = (text) => {
    const messageElement = document.createElement('div');
    messageElement.className = 'message system-message';
    messageElement.innerHTML = `
        <div class="message-content">${text}</div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
};

// Manejar envío de mensajes
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();

    if (!message) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(message);
            messageInput.value = '';
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            displaySystemMessage('Error al enviar el mensaje');
        }
    } else {
        displaySystemMessage('No se puede enviar el mensaje: WebSocket no está conectado');
    }
});

// Manejar cierre de sesión
logoutButton.addEventListener('click', () => {
    if (ws) {
        ws.close();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('email');
    window.location.href = 'login.html';
});

// Iniciar verificación de autenticación
checkAuth(); 