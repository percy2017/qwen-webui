// --- src/public/js/api.js ---

import { showAlert } from './ui.js';

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
            throw new Error(responseData.message || `Error del servidor: ${response.status}`);
        }
        
        return responseData;
    } catch (error) {
        showAlert(error.message, 'error');
        console.error(`Error en la petición a ${endpoint}:`, error);
        return { success: false, message: error.message };
    }
}

export async function fetchProjects() {
    const result = await request('/projects');
    return result.success ? result.projects : [];
}

export async function createNewProject(name, stack, description, litellmUrl, model) {
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

export async function fetchModels(litellmUrl) {
    const apiKey = localStorage.getItem('qwen_api_key');
    if (!litellmUrl || !apiKey) return [];
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

export async function fetchUserInfo() {
    const litellmUrl = localStorage.getItem('qwen_litellm_url');
    if (!litellmUrl) {
        console.error("No se encontró la URL de LiteLLM para obtener la info del usuario.");
        return null;
    }
    const endpoint = `/user/info?litellmUrl=${encodeURIComponent(litellmUrl)}`;
    const result = await request(endpoint);
    return result.success ? result.data : null;
}
