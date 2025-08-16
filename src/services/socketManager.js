import { spawn } from 'child_process';
import path from 'path';
import { db } from '../db/database.js';

export function initializeSocketManager(io) {
    io.use((socket, next) => {
        const apiKey = socket.handshake.auth.apiKey;
        if (!apiKey) {
            return next(new Error('Authentication error: No API key provided.'));
        }
        socket.apiKey = apiKey;
        next();
    });

    io.on('connection', (socket) => {
        console.log('Usuario conectado:', socket.id, 'con API Key:', socket.apiKey);

        socket.on('userMessage', async (data) => {
            const { projectId, message } = data;
            if (!projectId || !message) {
                return socket.emit('agentError', { message: 'Falta projectId o mensaje.' });
            }
            const projectPath = path.join(process.cwd(), 'workspaces', socket.apiKey, projectId);

            try {
                // 1. Guardar mensaje de usuario en la DB (para la UI)
                await db.run('INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)', [projectId, socket.apiKey, 'user', message]);

                // 2. Obtener historial reciente de la DB para construir el prompt
                const history = await db.all('SELECT role, content FROM chats WHERE project_name = ? AND api_key = ? ORDER BY timestamp DESC LIMIT 10', [projectId, socket.apiKey]);
                
                // 3. Construir el prompt completo en memoria
                const fullPrompt = history.reverse().map(msg => {
                    return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
                }).join('\n');

                // 4. Invocar al agente (¡YA NO TOCAMOS QWEN.md!)
                socket.emit('agentMessage', { type: 'start' });
                const qwenProcess = spawn('qwen', ['--yolo'], { cwd: projectPath, shell: true });
                let fullResponse = '';
                let fullError = '';

                qwenProcess.stdout.on('data', (chunk) => {
                    const chunkStr = chunk.toString();
                    fullResponse += chunkStr;
                    socket.emit('agentMessage', { type: 'chunk', data: chunkStr });
                });
                qwenProcess.stderr.on('data', (chunk) => {
                    fullError += chunk.toString();
                });
                qwenProcess.on('close', async (code) => {
                    const trimmedResponse = fullResponse.trim();
                    if (code === 0 && trimmedResponse) {
                        // 5. Guardar respuesta del asistente en la DB (para la UI)
                        await db.run('INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)', [projectId, socket.apiKey, 'assistant', trimmedResponse]);
                    } else {
                        const errorMessage = fullError || `El proceso finalizó con código ${code}.`;
                        socket.emit('agentError', { message: errorMessage });
                    }
                    socket.emit('agentMessage', { type: 'end' });
                });
                qwenProcess.on('error', (err) => {
                    socket.emit('agentError', { message: `Error al ejecutar el agente: ${err.message}` });
                });
                
                // 6. Pasar el prompt completo al agente por stdin
                qwenProcess.stdin.write(fullPrompt + '\n');
                qwenProcess.stdin.end();

            } catch (error) {
                socket.emit('agentError', { message: `Error interno del servidor: ${error.message}` });
            }
        });

        socket.on('disconnect', () => {
            console.log('Usuario desconectado:', socket.id);
        });
    });
}