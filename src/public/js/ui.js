// --- src/public/js/ui.js ---

// Muestra alertas usando SweetAlert2
export function showAlert(message, type = 'error') {
    const icon = type === 'success' ? 'success' : 'error';
    const title = type === 'success' ? '¡Éxito!' : 'Error';
    Swal.fire({
        icon, title, text: message, toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000, timerProgressBar: true
    });
}

export function showSuccess(message) {
    showAlert(message, 'success');
}

// Añade un mensaje a la terminal de chat
export function appendTerminalMessage(message, type = 'system') {
    const chatTerminal = document.getElementById('chatTerminal');
    if (!chatTerminal) return;
    const p = document.createElement('p');
    p.className = `${type}-message`;
    p.textContent = message;
    chatTerminal.appendChild(p);
    chatTerminal.scrollTop = chatTerminal.scrollHeight;
}

// Activa o desactiva los controles del chat
export function setChatActive(isActive) {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const startChatBtn = document.getElementById('startChatBtn');
    const stopChatBtn = document.getElementById('stopChatBtn');
    
    if (userInput) userInput.disabled = !isActive;
    if (sendBtn) sendBtn.disabled = !isActive;
    if (startChatBtn) startChatBtn.disabled = isActive;
    if (stopChatBtn) stopChatBtn.disabled = !isActive;
}