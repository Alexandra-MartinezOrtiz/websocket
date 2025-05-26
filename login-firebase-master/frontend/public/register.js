const API_URL = 'http://localhost:8080/api';

const registerForm = document.getElementById('register-form');
const errorMessage = document.getElementById('error-message');

// Manejar el envío del formulario
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Las contraseñas no coinciden.';
        return;
    }

    try {
        // Intentar registrar usuario
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al registrar usuario');
        }

        // Redirigir al login
        window.location.href = 'login.html';
    } catch (error) {
        // Mostrar mensaje de error
        errorMessage.style.display = 'block';
        errorMessage.textContent = error.message || 'Error al registrar usuario. Por favor, inténtalo de nuevo.';
    }
}); 