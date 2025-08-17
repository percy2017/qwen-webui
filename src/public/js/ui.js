// --- src/public/js/ui.js ---

/**
 * Muestra alertas tostadas usando SweetAlert2.
 */
export function showAlert(message, type = 'error') {
    Swal.fire({
        icon: type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        text: message,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
}

/**
 * Añade un mensaje al panel de Log del Sistema.
 */
export function addSystemLogMessage(message) {
    const systemTerminalLog = document.getElementById('system-terminal-log');
    if (!systemTerminalLog) return;
    if (systemTerminalLog.querySelector('.text-muted')) {
        systemTerminalLog.innerHTML = '';
    }
    const messageElement = document.createElement('div');
    messageElement.className = 'system-log-message';
    messageElement.textContent = `> ${message}`;
    systemTerminalLog.appendChild(messageElement);
    systemTerminalLog.scrollTop = systemTerminalLog.scrollHeight;
}

/**
 * Añade una burbuja de chat al historial.
 */
export function addChatMessage(role, content = '') {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return null;

    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${role}-message`;

    if (role === 'user') {
        messageContainer.textContent = content;
    } else {
        messageContainer.innerHTML = '<span class="blinking-cursor"></span>';
    }

    chatHistory.appendChild(messageContainer);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return role === 'assistant' ? messageContainer : null;
}

/**
 * Actualiza un mensaje del asistente. Limpia los logs de herramientas y formatea
 * el código para una visualización clara y ordenada.
 * @param {HTMLElement} assistantMessageElement - El elemento del mensaje del asistente.
 * @param {string} fullContent - El contenido completo acumulado.
 */
export function updateAssistantMessage(assistantMessageElement, fullContent) {
    if (!assistantMessageElement) return;

    // Elimina el cursor parpadeante si existe
    const cursor = assistantMessageElement.querySelector('.blinking-cursor');
    if (cursor) cursor.remove();

    // --- INICIO DE LA NUEVA LÓGICA DE PARSEO ROBUSTA ---

    let finalHtml = '';

    // Regex para detectar si hay una acción de escritura de archivo en el texto
    const toolActionRegex = /\[.*?\] 🔧 Executing tool: write_file/;

    if (toolActionRegex.test(fullContent)) {
        // 1. Extraer las partes importantes: texto previo, código, nombre de archivo y texto posterior.
        const contentRegex = /([\s\S]*?)\[.*?\] 🔧 Executing tool: write_file \(content: "([\s\S]*?)", file_path: ".*?[\\/]([\w.-]+\.(?:html|css|js|json|md))"\)[\s\S]*?✅ Tool write_file completed successfully[\s\S]*?(\n\n.*|$)/m;
        const match = fullContent.match(contentRegex);

        if (match) {
            const textBefore = match[1] || '';
            const codeContent = match[2] || '';
            const fileName = match[3] || 'archivo';
            const textAfter = match[4] || '';

            // 2. Construir el HTML limpio
            const summaryHtml = `<div class="tool-log-summary">✅ <strong>Acción del sistema:</strong> Se guardó el archivo <code>${fileName}</code>.</div>`;
            
            // Determinar el lenguaje para el resaltado
            const language = fileName.split('.').pop();
            const highlightedCode = hljs.highlight(codeContent.trim(), { language, ignoreIllegals: true }).value;

            const codeBlockHtml = `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span>${language}</span>
                        <button class="copy-code-btn"><i class="bi bi-clipboard"></i> Copiar</button>
                    </div>
                    <pre><code class="language-${language}">${highlightedCode}</code></pre>
                </div>
            `;
            
            // 3. Unir todas las partes
            finalHtml = marked.parse(textBefore) + summaryHtml + codeBlockHtml + marked.parse(textAfter);

        } else {
            // Si el regex falla por alguna razón, mostramos el texto como viene para no perder información.
            finalHtml = marked.parse(fullContent);
        }

    } else {
        // Si no es una acción de 'write_file', es un mensaje normal. Lo procesamos con Markdown.
        finalHtml = marked.parse(fullContent);
    }
    
    assistantMessageElement.innerHTML = finalHtml;
    
    // --- FIN DE LA NUEVA LÓGICA ---

    // Añadir funcionalidad a todos los botones de copiar que se acaban de crear
    assistantMessageElement.querySelectorAll('.copy-code-btn').forEach(btn => {
        btn.onclick = () => {
            const codeBlock = btn.closest('.code-block-wrapper').querySelector('code');
            copyCode(codeBlock, btn);
        };
    });

    const chatHistory = document.getElementById('chat-history');
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

/**
 * Función para copiar el contenido de un bloque de código.
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
 * Activa o desactiva los controles del chat.
 */
export function setChatActive(isActive) {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    if (userInput) userInput.disabled = !isActive;
    if (sendBtn) sendBtn.disabled = !isActive;
    if (isActive) userInput.focus();
}