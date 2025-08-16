// --- src/public/js/dashboard.js ---

import * as api from './api.js';
import * as ui from './ui.js';

let socket;
let currentProject = null;
let assistantMessageElement = null;
let fullAssistantResponse = '';

export function initializeDashboard() {
    const elements = {
        projectsList: document.getElementById('projectsList'),
        newProjectLink: document.getElementById('newProjectLink'),
        settingsLink: document.getElementById('settingsLink'),
        logoutLink: document.getElementById('logoutLink'),
        userInput: document.getElementById('userInput'),
        sendBtn: document.getElementById('sendBtn'),
        attachFileBtn: document.getElementById('attach-file-btn'),
        projectContextPanel: document.getElementById('projectContextPanel'),
        chatHeader: document.getElementById('chat-header'),
        chatHistory: document.getElementById('chat-history'),
        systemTerminal: document.getElementById('system-terminal'),
        newProjectModal: new bootstrap.Modal(document.getElementById('newProjectModal')),
        settingsModal: new bootstrap.Modal(document.getElementById('settingsModal')),
        newProjectForm: document.getElementById('newProjectForm'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        modelSelect: document.getElementById('modelSelect'),
        currentProjectModelSelect: document.getElementById('currentProjectModel'),
        themeSelect: document.getElementById('themeSelect')
    };

    ui.setChatActive(false);
    initSockets();
    loadAndRenderProjects();
    setupEventListeners();

    function setupEventListeners() {
        elements.logoutLink.addEventListener('click', handleLogout);
        elements.sendBtn.addEventListener('click', sendMessage);
        
        const adjustTextareaHeight = () => {
            elements.userInput.style.height = 'auto';
            elements.userInput.style.height = `${elements.userInput.scrollHeight}px`;
        };
        elements.userInput.addEventListener('input', adjustTextareaHeight);
        elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
                setTimeout(() => adjustTextareaHeight(), 0);
            }
        });

        elements.newProjectLink.addEventListener('click', () => {
            elements.newProjectModal.show();
        });
        elements.newProjectForm.addEventListener('submit', handleCreateProject);
        elements.settingsLink.addEventListener('click', handleOpenSettings);
        elements.saveSettingsBtn.addEventListener('click', handleSaveSettings);
    }

    function initSockets() {
        socket = io({ auth: { apiKey: localStorage.getItem('qwen_api_key') } });
        socket.on('connect', () => ui.addSystemLogMessage('Conectado al servidor.'));
        socket.on('disconnect', () => ui.addSystemLogMessage('Desconectado. Intentando reconectar...'));
        socket.on('agentMessage', handleAgentMessage);
        socket.on('agentError', (error) => {
            ui.addSystemLogMessage(`Error del agente: ${error.message}`);
            resetAgentState();
        });
    }

    function handleAgentMessage({ type, data }) {
        if (type === 'start') {
            fullAssistantResponse = '';
            assistantMessageElement = ui.addChatMessage('assistant');
            updateProjectStatus('Procesando...');
        } else if (type === 'chunk') {
            fullAssistantResponse += data;
            ui.updateAssistantMessage(assistantMessageElement, fullAssistantResponse);
        } else if (type === 'end') {
            resetAgentState();
        }
    }
    
    function resetAgentState() {
        updateProjectStatus('Activo');
        ui.setChatActive(true);
        assistantMessageElement = null;
        fullAssistantResponse = '';
    }

    async function loadAndRenderProjects() {
        elements.projectsList.innerHTML = '<li class="nav-item"><a class="nav-link disabled">Cargando...</a></li>';
        const projects = await api.fetchProjects();
        elements.projectsList.innerHTML = '';
        if (projects.length > 0) {
            projects.forEach(p => renderProjectLink(p));
        } else {
            elements.projectsList.innerHTML = '<li class="nav-item"><a class="nav-link disabled">No hay proyectos</a></li>';
        }
    }

    function renderProjectLink(project) {
        const li = document.createElement('li');
        li.className = 'nav-item d-flex justify-content-between align-items-center';
        li.setAttribute('data-project-id', project.id);
        const a = document.createElement('a');
        a.className = 'nav-link flex-grow-1';
        a.href = '#';
        a.textContent = project.name;
        a.onclick = (e) => { e.preventDefault(); selectProject(project, li); };
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger ms-2';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeleteProject(project.name); };
        li.appendChild(a);
        li.appendChild(deleteBtn);
        elements.projectsList.appendChild(li);
    }

    async function selectProject(projectData, projectElement) {
        document.querySelectorAll('#projectsList > li').forEach(li => li.classList.remove('active', 'bg-primary-subtle'));
        projectElement.classList.add('active', 'bg-primary-subtle');
        currentProject = projectData;
        elements.chatHeader.textContent = `Terminal de Interacción: ${projectData.name}`;
        elements.chatHistory.innerHTML = '<div class="text-center text-muted">Cargando historial...</div>';
        ui.addSystemLogMessage(`Proyecto seleccionado: ${projectData.name}`);
        updateProjectContextPanel(projectData);
        await updateProjectStatusPanel(projectData.name);
        
        // --- CORRECCIÓN DEFINITIVA AQUÍ ---
        const chatHistoryResponse = await api.fetchChatHistory(projectData.name);
        // Nos aseguramos de pasar solo el array, no el objeto entero
        if (chatHistoryResponse) {
             renderChatHistory(chatHistoryResponse);
        }
        // --- FIN DE LA CORRECCIÓN ---

        ui.setChatActive(true);
    }
    
    function renderChatHistory(history) {
        elements.chatHistory.innerHTML = '';
        // La validación `Array.isArray` es una capa extra de seguridad.
        if (!history || !Array.isArray(history) || history.length === 0) {
            elements.chatHistory.innerHTML = '<div class="text-center text-muted">No hay mensajes. ¡Comienza la conversación!</div>';
            return;
        }
        history.forEach(msg => {
            const el = ui.addChatMessage(msg.role, msg.content);
            if (msg.role === 'assistant') {
                ui.updateAssistantMessage(el, msg.content);
            }
        });
    }

    function updateProjectContextPanel(project) {
        elements.projectContextPanel.innerHTML = `
            <h6><i class="bi bi-stack me-2"></i>Stack:</h6><p>${project.stack || 'No definido'}</p>
            <h6><i class="bi bi-card-text me-2"></i>Descripción:</h6><p>${project.description || 'Sin descripción'}</p>
        `;
    }

    async function updateProjectStatusPanel(projectName) {
        const projectInfo = await api.fetchProjectInfo(projectName);
        if (projectInfo && projectInfo.envConfig) {
            document.getElementById('selectedModel').textContent = projectInfo.envConfig.OPENAI_MODEL || 'No definido';
            updateProjectStatus('Activo');
        }
    }
    
    function updateProjectStatus(status) {
        const statusEl = document.getElementById('projectStatus');
        statusEl.textContent = status;
        statusEl.className = 'badge';
        if (status === 'Activo') statusEl.classList.add('bg-success');
        else if (status === 'Inactivo') statusEl.classList.add('bg-secondary');
        else statusEl.classList.add('bg-info');
    }

    function sendMessage() {
        const message = elements.userInput.value.trim();
        if (!message || !socket || !socket.connected || !currentProject) return;
        ui.addChatMessage('user', message);
        socket.emit('userMessage', { projectId: currentProject.name, message: message });
        elements.userInput.value = '';
        elements.userInput.style.height = 'auto';
        ui.setChatActive(false);
    }

    async function handleCreateProject(e) {
        e.preventDefault();
        const name = document.getElementById('projectName').value;
        const stack = document.getElementById('projectStack').value;
        const description = document.getElementById('projectDescription').value;
        const litellmUrl = localStorage.getItem('qwen_litellm_url');
        const model = localStorage.getItem('qwen_default_model');
        if (!model) {
            return ui.showAlert('Por favor, selecciona un modelo por defecto en Ajustes antes de crear un proyecto.', 'error');
        }
        if (!name || !stack || !description) {
            return ui.showAlert('Por favor completa todos los campos del proyecto.', 'warning');
        }
        const result = await api.createNewProject(name, stack, description, litellmUrl, model);
        if (result.success) {
            elements.newProjectModal.hide();
            elements.newProjectForm.reset();
            loadAndRenderProjects();
            ui.showAlert(`Proyecto "${name}" creado.`, 'success');
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
                ui.showAlert(`Proyecto "${projectName}" eliminado.`, 'success');
                loadAndRenderProjects();
                if (currentProject && currentProject.name === projectName) {
                    currentProject = null;
                    elements.chatHistory.innerHTML = '<div class="text-center text-muted">Selecciona un proyecto para comenzar.</div>';
                    elements.projectContextPanel.innerHTML = '<p class="text-muted">Selecciona un proyecto para ver sus detalles.</p>';
                    ui.setChatActive(false);
                }
            }
        }
    }
    
    async function populateModelSelect(selectElement, selectedValue = null) {
        const litellmUrl = localStorage.getItem('qwen_litellm_url');
        selectElement.innerHTML = '<option>Cargando...</option>';
        const models = await api.fetchModels(litellmUrl);
        selectElement.innerHTML = '';
        if (models && models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                if (model.id === selectedValue) option.selected = true;
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
        if (currentProject && currentProject.name) {
            document.querySelector('#settingsForProjectName').textContent = currentProject.name;
            document.querySelector('#currentProjectSettings').style.display = 'block';
            currentProjectModelSelect.disabled = false;
            const projectInfo = await api.fetchProjectInfo(currentProject.name);
            if (projectInfo && projectInfo.envConfig && projectInfo.envConfig.OPENAI_MODEL) {
                await populateModelSelect(currentProjectModelSelect, projectInfo.envConfig.OPENAI_MODEL);
            } else {
                await populateModelSelect(currentProjectModelSelect);
            }
        } else {
            document.querySelector('#currentProjectSettings').style.display = 'none';
        }
        elements.settingsModal.show();
    }
    
    async function handleSaveSettings() {
        const { modelSelect, currentProjectModelSelect, themeSelect } = elements;
        localStorage.setItem('qwen_default_model', modelSelect.value);
        document.documentElement.setAttribute('data-bs-theme', themeSelect.value);
        localStorage.setItem('theme', themeSelect.value);
        if (currentProject && currentProject.name && !currentProjectModelSelect.disabled) {
            const success = await api.updateProjectConfig(currentProject.name, localStorage.getItem('qwen_litellm_url'), currentProjectModelSelect.value);
            if (success) {
                document.getElementById('selectedModel').textContent = currentProjectModelSelect.value;
                ui.showAlert('Modelo del proyecto actualizado.', 'success');
            }
        }
        elements.settingsModal.hide();
        ui.showAlert('Ajustes guardados.', 'success');
    }
}