// --- src/public/js/dashboard.js ---

import * as api from './api.js';
import * as ui from './ui.js';

// Variables de estado del Dashboard
let socket;
let currentProject = {
    id: null,
    name: null,
    context: null
};

export function initializeDashboard() {
    // Referencias a elementos del DOM
    const elements = {
        projectsList: document.getElementById('projectsList'),
        newProjectLink: document.getElementById('newProjectLink'),
        settingsLink: document.getElementById('settingsLink'),
        logoutLink: document.getElementById('logoutLink'),
        startChatBtn: document.getElementById('startChatBtn'),
        stopChatBtn: document.getElementById('stopChatBtn'),
        userInput: document.getElementById('userInput'),
        sendBtn: document.getElementById('sendBtn'),
        projectContextPanel: document.getElementById('projectContextPanel'),
        // Modales
        newProjectModal: new bootstrap.Modal(document.getElementById('newProjectModal')),
        settingsModal: new bootstrap.Modal(document.getElementById('settingsModal')),
        // Formulario Nuevo Proyecto
        newProjectForm: document.getElementById('newProjectForm'),
        // Formulario Ajustes
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        modelSelect: document.getElementById('modelSelect'),
        currentProjectModelSelect: document.getElementById('currentProjectModel'),
        themeSelect: document.getElementById('themeSelect')

        
    };

    // --- Inicialización ---
    ui.setChatActive(false);
    initSockets();
    loadAndRenderProjects();

    // --- Manejadores de Eventos ---
    elements.logoutLink.addEventListener('click', handleLogout);
    elements.startChatBtn.addEventListener('click', handleStartChat);
    elements.stopChatBtn.addEventListener('click', handleStopChat);
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Modales
    elements.newProjectLink.addEventListener('click', () => {
        document.getElementById('projectApiKey').value = localStorage.getItem('qwen_api_key');
        elements.newProjectModal.show();
    });
    elements.newProjectForm.addEventListener('submit', handleCreateProject);
    elements.settingsLink.addEventListener('click', handleOpenSettings);
    elements.saveSettingsBtn.addEventListener('click', handleSaveSettings);

    // --- Funciones de Lógica ---
    function initSockets() {
        socket = io();
        socket.on('connect', () => ui.appendTerminalMessage('Conectado al servidor.', 'system'));
        socket.on('disconnect', () => ui.appendTerminalMessage('Desconectado. Reconectando...', 'error'));
        socket.on('agentMessage', (data) => {
            ui.appendTerminalMessage(data.data, data.type);
            if (data.type === 'close' || data.type === 'error') {
                ui.setChatActive(false);
            }
        });
    }

    async function loadAndRenderProjects() {
        elements.projectsList.innerHTML = '<li class="nav-item"><a class="nav-link disabled">Cargando...</a></li>';
        const projects = await api.fetchProjects();
        elements.projectsList.innerHTML = '';
        if (projects.length > 0) {
            projects.forEach(p => {
                const li = document.createElement('li');
                li.className = 'nav-item d-flex justify-content-between align-items-center';
                
                const a = document.createElement('a');
                a.className = 'nav-link';
                a.href = '#';
                a.textContent = p.name;
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    selectProject(p, a);
                });
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
                deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
                deleteBtn.onclick = () => handleDeleteProject(p.name);
                
                li.appendChild(a);
                li.appendChild(deleteBtn);
                elements.projectsList.appendChild(li);
            });
        } else {
            elements.projectsList.innerHTML = '<li class="nav-item"><a class="nav-link disabled">No hay proyectos</a></li>';
        }
    }

    function selectProject(projectData, linkElement) {
        document.querySelectorAll('#projectsList .nav-link').forEach(link => link.classList.remove('active'));
        linkElement.classList.add('active');

        currentProject.id = projectData.id;
        currentProject.name = projectData.name;
        currentProject.context = {
            name: projectData.name,
            stack: projectData.stack,
            description: projectData.description
        };

        elements.projectContextPanel.innerHTML = `
            <h6>Nombre:</h6><p>${projectData.name}</p>
            <h6>Stack:</h6><p>${projectData.stack}</p>
            <h6>Descripción:</h6><p>${projectData.description}</p>
        `;

        updateProjectStatusPanel(projectData.name);
        ui.appendTerminalMessage(`Proyecto seleccionado: ${projectData.name}`, 'system');
        elements.startChatBtn.disabled = false;
    }
    
    async function updateProjectStatusPanel(projectName) {
        const projectInfo = await api.fetchProjectInfo(projectName);
        if (projectInfo) {
            document.getElementById('selectedModel').textContent = projectInfo.envConfig.OPENAI_MODEL || 'No definido';
            document.getElementById('projectStatus').innerHTML = '<span class="badge bg-secondary">Inactivo</span>';
        }
    }

    function handleStartChat() {
        if (!currentProject.id) {
            return ui.showAlert('Por favor, selecciona un proyecto primero.', 'warning');
        }
        ui.appendTerminalMessage('Iniciando sesión de chat...', 'system');
        socket.emit('startChat', {
            apiKey: localStorage.getItem('qwen_api_key'),
            projectId: currentProject.name,
            projectContext: currentProject.context
        });
        ui.setChatActive(true);
        document.getElementById('projectStatus').innerHTML = '<span class="badge bg-success">Activo</span>';
    }

    function handleStopChat() {
        socket.emit('stopChat');
        ui.appendTerminalMessage('Deteniendo sesión de chat...', 'system');
        ui.setChatActive(false);
        document.getElementById('projectStatus').innerHTML = '<span class="badge bg-secondary">Inactivo</span>';
    }

    function sendMessage() {
        const message = elements.userInput.value.trim();
        if (message && socket && socket.connected) {
            ui.appendTerminalMessage(`> ${message}`, 'user');
            socket.emit('userMessage', { message });
            elements.userInput.value = '';
        } else {
            ui.showAlert('No estás conectado al servidor.', 'error');
        }
    }

    function handleLogout(e) {
        e.preventDefault();
        Swal.fire({
            title: '¿Cerrar sesión?', icon: 'question', showCancelButton: true,
            confirmButtonText: 'Sí, cerrar sesión', cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                sessionStorage.clear();
                if (socket) socket.disconnect();
                window.location.href = '/';
            }
        });
    }
    
    async function handleDeleteProject(projectName) {
        const result = await Swal.fire({
            title: `¿Eliminar "${projectName}"?`, text: "Esta acción no se puede deshacer.",
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            const res = await api.deleteProject(projectName);
            if (res.success) {
                ui.showSuccess(`Proyecto "${projectName}" eliminado.`);
                loadAndRenderProjects();
            } else {
                ui.showAlert(res.message || 'Error al eliminar proyecto.');
            }
        }
    }

    async function handleCreateProject(e) {
        e.preventDefault();
        const name = document.getElementById('projectName').value;
        const stack = document.getElementById('projectStack').value;
        const description = document.getElementById('projectDescription').value;
        const apiKey = document.getElementById('projectApiKey').value;
        const litellmUrl = localStorage.getItem('qwen_litellm_url');

        if (!name || !stack || !description) {
            return ui.showAlert('Por favor completa todos los campos.', 'warning');
        }

        const result = await api.createNewProject(name, stack, description, apiKey, litellmUrl);
        if (result.success) {
            elements.newProjectModal.hide();
            elements.newProjectForm.reset();
            loadAndRenderProjects();
            ui.showSuccess(`Proyecto "${name}" creado.`);
        } else {
            ui.showAlert(result.message || 'Error al crear proyecto.');
        }
    }
    
    // -- Lógica del Modal de Ajustes --
    
    async function populateModelSelect(selectElement, selectedValue = null) {
        const litellmUrl = localStorage.getItem('qwen_litellm_url');
        selectElement.innerHTML = '<option>Cargando...</option>';
        const models = await api.fetchModels(litellmUrl);
        selectElement.innerHTML = '';
        if (models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                if (model.id === selectedValue) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        } else {
            selectElement.innerHTML = '<option>Error al cargar</option>';
        }
    }

    async function handleOpenSettings(e) {
        e.preventDefault();
        const { modelSelect, currentProjectModelSelect, themeSelect } = elements;
        
        const defaultModel = localStorage.getItem('qwen_default_model') || '';
        await populateModelSelect(modelSelect, defaultModel);

        themeSelect.value = localStorage.getItem('theme') || 'dark';

        if (currentProject.name) {
            currentProjectModelSelect.disabled = false;
            const projectInfo = await api.fetchProjectInfo(currentProject.name);
            if (projectInfo && projectInfo.envConfig.OPENAI_MODEL) {
                await populateModelSelect(currentProjectModelSelect, projectInfo.envConfig.OPENAI_MODEL);
            } else {
                await populateModelSelect(currentProjectModelSelect);
            }
        } else {
            currentProjectModelSelect.disabled = true;
            currentProjectModelSelect.innerHTML = '<option selected disabled>Selecciona un proyecto</option>';
        }
        elements.settingsModal.show();
    }
    
    async function handleSaveSettings() {
        const { modelSelect, currentProjectModelSelect, themeSelect } = elements;
        
        localStorage.setItem('qwen_default_model', modelSelect.value);
        
        document.documentElement.setAttribute('data-bs-theme', themeSelect.value);
        localStorage.setItem('theme', themeSelect.value);

        if (currentProject.name && !currentProjectModelSelect.disabled) {
            const success = await api.updateProjectConfig(
                currentProject.name,
                localStorage.getItem('qwen_litellm_url'),
                currentProjectModelSelect.value
            );
            if (success) {
                document.getElementById('selectedModel').textContent = currentProjectModelSelect.value;
                ui.showSuccess('Modelo del proyecto actualizado.');
            }
        }
        elements.settingsModal.hide();
        ui.showSuccess('Ajustes guardados.');
    }

     if (typeof feather !== 'undefined') {
        console.log("DEBUG: Reemplazando Feather Icons...");
        feather.replace();
    }
}