// --- src/public/js/api.js ---

import { showAlert } from './ui.js';

// Función para obtener la API Key del almacenamiento
function getApiKey() {
    return localStorage.getItem('qwen_api_key');
}

// Carga la lista de proyectos desde el servidor
export async function fetchProjects() {
    try {
        const response = await fetch('/api/projects', {
            headers: { 'Authorization': `Bearer ${getApiKey()}` }
        });
        if (!response.ok) throw new Error('Error de autorización o del servidor.');
        const data = await response.json();
        if (data.success) {
            return data.projects;
        } else {
            throw new Error(data.message || 'No se pudieron cargar los proyectos.');
        }
    } catch (error) {
        showAlert(error.message, 'error');
        // Si falla la carga, probablemente la sesión es inválida
        window.location.href = '/'; 
        return [];
    }
}

// Carga la información detallada de un proyecto
export async function fetchProjectInfo(projectName) {
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/info`, {
            headers: { 'Authorization': `Bearer ${getApiKey()}` }
        });
        if (!response.ok) throw new Error('No se pudo obtener la info del proyecto.');
        const result = await response.json();
        return result.success ? result.project : null;
    } catch (error) {
        showAlert(error.message, 'error');
        return null;
    }
}

// Carga la lista de modelos de IA disponibles
export async function fetchModels(litellmUrl) {
     try {
        const response = await fetch(`/api/models?litellmUrl=${encodeURIComponent(litellmUrl)}&apiKey=${encodeURIComponent(getApiKey())}`);
        const data = await response.json();
        return (data.success && data.data.data) ? data.data.data : [];
    } catch (error) {
        showAlert('Error de red al cargar modelos.', 'error');
        return [];
    }
}

// Actualiza la configuración de un proyecto
export async function updateProjectConfig(projectName, litellmUrl, selectedModel) {
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/config`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getApiKey()}`
            },
            body: JSON.stringify({
                apiKey: getApiKey(),
                litellmUrl,
                selectedModel
            })
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        showAlert('Error de red al actualizar la configuración.', 'error');
        return false;
    }
}

// Crea un nuevo proyecto
export async function createNewProject(name, stack, description, apiKey, litellmUrl) {
     try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, stack, description, apiKey, litellmUrl })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        showAlert('Error de red al crear el proyecto.');
        return { success: false, message: 'Error de red.' };
    }
}

// Elimina un proyecto
export async function deleteProject(projectName) {
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getApiKey()}` }
        });
        const res = await response.json();
        return res;
    } catch(e) {
        showAlert('Error de red al eliminar.');
        return { success: false, message: 'Error de red.' };
    }
}