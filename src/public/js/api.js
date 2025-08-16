// --- src/public/js/api.js ---

import { showAlert } from './ui.js';

/**
 * Función centralizada para todas las peticiones a la API.
 * Maneja automáticamente la autenticación, los errores y el formato JSON.
 * @param {string} endpoint - El endpoint de la API (ej: '/projects').
 * @param {object} options - Opciones de Fetch (method, body, etc.).
 * @returns {Promise<object>} - La respuesta del servidor.
 */
async function request(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('qwen_api_key')}`
    };
    const config = { ...options, headers };

    try {
        const response = await fetch(`/api${endpoint}`, config);
        const responseData = await response.json();
        
        if (!response.ok) {
            // Si la respuesta no es exitosa, lanza un error con el mensaje del servidor
            throw new Error(responseData.message || `Error del servidor: ${response.status}`);
        }
        
        return responseData; // { success: true, ... }
    } catch (error) {
        // Muestra el error al usuario y devuelve un objeto de fallo consistente
        showAlert(error.message, 'error');
        console.error(`Error en la petición a ${endpoint}:`, error);
        return { success: false, message: error.message };
    }
}


// --- FUNCIONES DE LA API REESCRITAS Y CORREGIDAS ---

export async function fetchProjects() {
    const result = await request('/projects');
    return result.success ? result.projects : [];
}

// CORREGIDO: Ahora acepta y envía el 'model'. La autenticación es automática.
export async function createNewProject(name, stack, description, litellmUrl, model) {
    // La apiKey se obtiene del header, no es necesaria en el body.
    return request('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, stack, description, litellmUrl, model })
    });
}

export async function deleteProject(projectName) {
    return request(`/projects/${encodeURIComponent(projectName)}`, {
        method: 'DELETE'
    });
}

export async function fetchChatHistory(projectName) {
    const result = await request(`/projects/${encodeURIComponent(projectName)}/chat`);
    return result.success ? result.history : [];
}

export async function fetchProjectInfo(projectName) {
    const result = await request(`/projects/${encodeURIComponent(projectName)}/info`);
    return result.success ? result : null;
}

export async function updateProjectConfig(projectName, litellmUrl, selectedModel) {
    const result = await request(`/projects/${encodeURIComponent(projectName)}/config`, {
        method: 'PUT',
        body: JSON.stringify({ litellmUrl, selectedModel })
    });
    return result.success;
}

// CORREGIDO: Simplificado para manejar la respuesta correcta del backend.
export async function fetchModels(litellmUrl) {
    const apiKey = localStorage.getItem('qwen_api_key');
    if (!litellmUrl || !apiKey) return [];
    
    // Esta llamada es especial por los query params, por eso no usa el wrapper `request`.
    try {
        const response = await fetch(`/api/models?litellmUrl=${encodeURIComponent(litellmUrl)}&apiKey=${encodeURIComponent(apiKey)}`);
        const result = await response.json();
        return result.success ? result.models : [];
    } catch (error) {
        showAlert('Error de red al cargar modelos.', 'error');
        console.error("Error al obtener modelos:", error);
        return [];
    }
}