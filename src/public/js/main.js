// --- src/public/js/main.js ---

import { initializeLoginPage } from './auth.js';
import { initializeDashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Lógica para detectar en qué página estamos
    const isDashboard = document.getElementById('dashboard');
    const isLogin = document.getElementById('loginForm');

    // Cargar credenciales para tomar la decisión
    const apiKey = localStorage.getItem('qwen_api_key');
    const rememberMe = localStorage.getItem('qwen_remember_me') === 'true';
    const isLoggedInTemporarily = sessionStorage.getItem('isLoggedIn') === 'true';
    const isAuthenticated = apiKey && (rememberMe || isLoggedInTemporarily);

    if (isDashboard) {
        if (isAuthenticated) {
            initializeDashboard();
        } else {
            // Si intenta acceder al dashboard sin estar autenticado, lo redirigimos
            window.location.href = '/';
        }
    } else if (isLogin) {
        if (isAuthenticated) {
            // Si ya está autenticado y llega al login, lo mandamos al dashboard
            window.location.href = '/dashboard';
        } else {
            initializeLoginPage();
        }
    }

    // Inicialización del tema en todas las páginas
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Dark por defecto
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
});