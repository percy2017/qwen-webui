// --- src/public/js/ui.js ---

/**
 * Muestra alertas tostadas usando SweetAlert2.
 * @param {string} message - El mensaje a mostrar.
 * @param {'error' | 'success' | 'info'} type - El tipo de alerta.
 */
export function showAlert(message, type = 'error') {
    const icon = type;
    const title = {
        'success': '¡Éxito!',
        'error': 'Error',
        'info': 'Información'
    }[type];
    Swal.fire({
        icon, title, text: message, toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000, timerProgressBar: true
    });
}

/**
 * Añade un mensaje al log de sistema en la parte superior del chat.
 * @param {string} message - El mensaje de log.
 */
export function addSystemLogMessage(message) {
    const systemTerminal = document.getElementById('system-terminal');
    if (!systemTerminal) return;
    const messageElement = document.createElement('div');
    messageElement.className = 'system-log-message';
    messageElement.textContent = `> ${message}`;
    systemTerminal.appendChild(messageElement);
    systemTerminal.scrollTop = systemTerminal.scrollHeight;
}

/**
 * Añade una burbuja de chat al historial. Inicia el proceso de streaming para el asistente.
 * @param {'user' | 'assistant'} role - Quién envía el mensaje.
 * @param {string} content - El contenido del mensaje (completo para el usuario, vacío para el asistente).
 * @returns {HTMLElement | null} - El elemento del contenido del mensaje del asistente para el streaming.
 */
export function addChatMessage(role, content = '') {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return null;

    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${role}-message`;

    // Para mensajes de usuario, el contenido se renderiza de inmediato.
    if (role === 'user') {
        messageContainer.textContent = content;
    } 
    // Para el asistente, preparamos un contenedor que se llenará con el streaming.
    else {
        // Un cursor parpadeante mientras se espera la respuesta.
        messageContainer.innerHTML = '<span class="blinking-cursor"></span>';
    }

    chatHistory.appendChild(messageContainer);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Si es un mensaje de asistente, devolvemos el contenedor para el streaming.
    return role === 'assistant' ? messageContainer : null;
}

/**
 * Actualiza un mensaje del asistente con un nuevo trozo de texto (chunk) de streaming.
 * Renderiza Markdown en tiempo real.
 * @param {HTMLElement} assistantMessageElement - El elemento de la burbuja del mensaje del asistente.
 * @param {string} fullContent - El contenido completo acumulado hasta ahora.
 */
export function updateAssistantMessage(assistantMessageElement, fullContent) {
    // Elimina el cursor parpadeante en el primer chunk.
    const cursor = assistantMessageElement.querySelector('.blinking-cursor');
    if (cursor) cursor.remove();

    // Convierte el contenido completo a HTML usando la librería 'marked'
    assistantMessageElement.innerHTML = marked.parse(fullContent);

    // Post-procesamiento para añadir funcionalidades a los bloques de código
    assistantMessageElement.querySelectorAll('pre code').forEach(block => {
        // Evita añadir el header si ya existe
        if (block.parentElement.querySelector('.code-block-header')) return;

        const pre = block.parentElement;
        const language = block.className.replace('hljs language-', '').trim() || 'shell';

        const header = document.createElement('div');
        header.className = 'code-block-header';

        const langSpan = document.createElement('span');
        langSpan.textContent = language;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar';
        copyBtn.onclick = () => copyCode(block, copyBtn);
        
        header.appendChild(langSpan);
        header.appendChild(copyBtn);

        pre.insertBefore(header, block);
    });

    // Auto-scroll del historial de chat
    const chatHistory = document.getElementById('chat-history');
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

/**
 * Función para copiar el contenido de un bloque de código.
 * @param {HTMLElement} block - El elemento <code> que contiene el texto.
 * @param {HTMLElement} button - El botón que fue presionado.
 */
function copyCode(block, button) {
    navigator.clipboard.writeText(block.textContent).then(() => {
        button.innerHTML = '<i class="bi bi-check-lg"></i> Copiado';
        setTimeout(() => {
            button.innerHTML = '<i class="bi bi-clipboard"></i> Copiar';
        }, 2000);
    }).catch(err => {
        button.textContent = 'Error al copiar';
        console.error('Error al copiar código: ', err);
    });
}


/**
 * Activa o desactiva los controles del chat y paneles.
 * @param {boolean} isActive - Si el chat debe estar activo.
 */
export function setChatActive(isActive) {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachFileBtn = document.getElementById('attach-file-btn');
    const viewStatsBtn = document.getElementById('viewStatsBtn');

    if (userInput) userInput.disabled = !isActive;
    if (sendBtn) sendBtn.disabled = !isActive;
    if (attachFileBtn) attachFileBtn.disabled = !isActive;
    if (viewStatsBtn) viewStatsBtn.disabled = !isActive;
    
    if (isActive) {
        userInput.focus();
    }
}