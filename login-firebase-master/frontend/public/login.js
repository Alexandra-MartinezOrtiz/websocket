const API_URL = 'http://localhost:8080/api';
const WS_URL = 'ws://localhost:8081';


const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

// Verificar si el usuario ya está autenticado
const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const response = await fetch(`${API_URL}/verify-token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.valid) {
                    window.location.href = 'index.html';
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('uid');
                }
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('uid');
            }
        } catch (error) {
            console.error('Error verifying token:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('uid');
        }
    }
};

checkAuth();

// Manejar el envío del formulario
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        // Intentar iniciar sesión
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al iniciar sesión');
        }



        // Guardar token y datos del usuario
        localStorage.setItem('token', data.token);
        localStorage.setItem('uid', data.uid);
        localStorage.setItem('email', data.email);
        
        // Redirigir al chat
        window.location.href = 'index.html';
    } catch (error) {
        // Mostrar mensaje de error
        errorMessage.style.display = 'block';
        errorMessage.textContent = error.message || 'Error al iniciar sesión. Por favor, verifica tus credenciales.';
    }
}); 