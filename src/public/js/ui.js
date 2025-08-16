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
 * Añade un mensaje al nuevo panel de Log del Sistema.
 * @param {string} message - El mensaje de log.
 */
export function addSystemLogMessage(message) {
    // --- INICIO DE LA MODIFICACIÓN ---
    // Apuntamos al nuevo ID del panel en la columna derecha
    const systemTerminalLog = document.getElementById('system-terminal-log');
    if (!systemTerminalLog) return;

    // Si es el primer mensaje, limpiamos el contenido inicial
    if (systemTerminalLog.querySelector('.text-muted')) {
        systemTerminalLog.innerHTML = '';
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'system-log-message';
    messageElement.textContent = `> ${message}`;
    systemTerminalLog.appendChild(messageElement);
    systemTerminalLog.scrollTop = systemTerminalLog.scrollHeight;
    // --- FIN DE LA MODIFICACIÓN ---
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
 * Actualiza un mensaje del asistente. Limpia los logs de herramientas y formatea
 * el código para una visualización clara y ordenada.
 * @param {HTMLElement} assistantMessageElement - El elemento del mensaje del asistente.
 * @param {string} fullContent - El contenido completo acumulado.
 */
export function updateAssistantMessage(assistantMessageElement, fullContent) {
    const cursor = assistantMessageElement.querySelector('.blinking-cursor');
    if (cursor) cursor.remove();

    // --- LÓGICA DE LIMPIEZA Y FORMATEO REFINADA ---

    let processedContent = fullContent;

    // Paso 1: Buscar el inicio del log de la herramienta.
    const toolStartRegex = /(\[.*?\] 🔧 Executing tool: write_file \(content: ")/i;
    const toolStartMatch = processedContent.match(toolStartRegex);

    if (toolStartMatch) {
        // Extraer el nombre del archivo para el mensaje de resumen
        const filePathMatch = processedContent.match(/file_path:.*?([\w\.]+\.html?)/i);
        const fileName = filePathMatch ? filePathMatch[1] : 'un archivo';
        const summaryMessage = `<div class="tool-log-summary">✅ <strong>Acción del sistema:</strong> Se guardó el archivo <code>${fileName}</code>.</div>`;

        // Reemplazar el inicio ruidoso del log con nuestro mensaje limpio.
        processedContent = processedContent.replace(toolStartRegex, summaryMessage);

        // Paso 2: Eliminar el final ruidoso del log (desde ", file_path..." hasta el diff).
        const toolEndRegex = /", file_path:[\s\S]*?(?=(Listo!|He creado|Here is the))/i;
        processedContent = processedContent.replace(toolEndRegex, '');
    }

    // Paso 3: Ahora que el contenido está limpio, buscamos y formateamos el bloque de código HTML.
    const htmlRegex = /(<!DOCTYPE html>[\s\S]*?<\/html>)/i;
    const htmlMatch = processedContent.match(htmlRegex);

    if (htmlMatch) {
        const htmlCode = htmlMatch[1];
        const parts = processedContent.split(htmlRegex);
        const textBefore = parts[0];
        const textAfter = parts[2] || '';

        const highlightedCode = hljs.highlight(htmlCode.trim(), { language: 'html' }).value;
        const codeBlockHtml = `<pre><code class="language-html">${highlightedCode}</code></pre>`;

        assistantMessageElement.innerHTML = 
            marked.parse(textBefore) + 
            codeBlockHtml + 
            marked.parse(textAfter);
    } else {
        // Si no hay HTML, simplemente procesamos el texto (que ya podría estar limpio).
        assistantMessageElement.innerHTML = marked.parse(processedContent);
    }

    // Post-procesamiento para el botón de copiar.
    assistantMessageElement.querySelectorAll('pre code').forEach(block => {
        if (block.parentElement.querySelector('.code-block-header')) return;
        const pre = block.parentElement;
        const language = block.className.replace(/hljs|language-/g, '').trim() || 'code';
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