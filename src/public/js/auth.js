// --- src/public/js/auth.js ---

import { showAlert } from './ui.js';

// Función para cargar credenciales guardadas
function loadCredentials() {
    const apiKey = localStorage.getItem('qwen_api_key');
    const litellmUrl = localStorage.getItem('qwen_litellm_url');
    const rememberMe = localStorage.getItem('qwen_remember_me') === 'true';
    return { apiKey, litellmUrl, rememberMe };
}

export function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const apiKeyInput = document.getElementById('apiKey');
    const litellmUrlInput = document.getElementById('litellmUrl');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const togglePasswordBtn = document.getElementById('togglePassword');

    // Rellenar campos si existen credenciales guardadas
    const creds = loadCredentials();
    if (creds.apiKey && creds.litellmUrl && creds.rememberMe) {
        apiKeyInput.value = creds.apiKey;
        litellmUrlInput.value = creds.litellmUrl;
        rememberMeCheckbox.checked = true;
    }

    // Toggle para ver contraseña
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = apiKeyInput.type === 'password' ? 'text' : 'password';
            apiKeyInput.type = type;
            togglePasswordBtn.querySelector('i').className = `bi bi-eye${type === 'password' ? '' : '-slash'}`;
        });
    }

    // Envío del formulario
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const apiKey = apiKeyInput.value.trim();
        const litellmUrl = litellmUrlInput.value.trim();
        const rememberMe = rememberMeCheckbox.checked;

        if (!apiKey || !litellmUrl) {
            return showAlert('Por favor, completa todos los campos.');
        }

        // Guardar credenciales en localStorage
        if (rememberMe) {
            localStorage.setItem('qwen_api_key', apiKey);
            localStorage.setItem('qwen_litellm_url', litellmUrl);
            localStorage.setItem('qwen_remember_me', 'true');
        } else {
            // Si no, se borran al cerrar sesión.
            // Guardamos temporalmente para la redirección
            localStorage.setItem('qwen_api_key', apiKey);
            localStorage.setItem('qwen_litellm_url', litellmUrl);
            localStorage.removeItem('qwen_remember_me');
            sessionStorage.setItem('isLoggedIn', 'true');
        }

        try {
            const response = await fetch('/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, litellmUrl })
            });
            const result = await response.json();
            if (result.success) {
                window.location.href = result.redirectUrl;
            } else {
                showAlert(result.message || 'Error en la conexión.');
            }
        } catch (error) {
            showAlert('Error de red. No se pudo conectar al servidor.');
        }
    });
}