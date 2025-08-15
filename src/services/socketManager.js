import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export function initializeSocketManager(io) {
    io.on('connection', (socket) => {
        console.log('Usuario conectado:', socket.id);
        
        let projectPath = '';
        let projectName = '';

        socket.on('startChat', (data) => {
            const { apiKey, projectId, projectContext } = data;
            
            projectName = projectContext.name || projectId;
            projectPath = path.join(process.cwd(), 'workspaces', apiKey, projectName);
            
            if (!fs.existsSync(projectPath)) {
                const errorMessage = `Error: El directorio del proyecto '${projectName}' no existe.`;
                console.error(errorMessage);
                socket.emit('agentMessage', { type: 'error', data: errorMessage });
                return;
            }
            
            console.log(`Agente para '${projectName}' listo en el directorio: ${projectPath}`);
            socket.emit('agentMessage', { type: 'system', data: `Agente para '${projectName}' listo. Puedes enviar mensajes.` });
        });

        socket.on('userMessage', (data) => {
            if (!projectPath) {
                socket.emit('agentMessage', { type: 'error', data: 'Por favor, inicia un chat primero seleccionando un proyecto.' });
                return;
            }

            console.log(`[${projectName}] Recibido: "${data.message}". Iniciando qwen...`);
            
            const qwenExecutable = 'qwen';
            const qwenArgs = ['--yolo'];

            const qwenProcess = spawn(qwenExecutable, qwenArgs, {
                cwd: projectPath,
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let fullResponse = '';
            let fullError = ''; // <--- MEJORA 1: Variable para capturar errores

            qwenProcess.stdout.on('data', (chunk) => {
                fullResponse += chunk.toString();
            });

            // <--- MEJORA 2: Capturar la salida de error estándar (stderr)
            qwenProcess.stderr.on('data', (chunk) => {
                fullError += chunk.toString();
            });

            qwenProcess.on('close', (code) => {
                console.log(`[${projectName}] Proceso finalizado (código ${code}). Respuesta: "${fullResponse.trim()}"`);
                if (code === 0) {
                    socket.emit('agentMessage', { type: 'stdout', data: fullResponse });
                } else {
                    // MEJORA 3: Enviar el mensaje de error capturado al usuario
                    const errorMessage = fullError || `El proceso falló con código ${code}.`;
                    console.error(`[${projectName}] Error del proceso: ${errorMessage}`);
                    socket.emit('agentMessage', { type: 'error', data: errorMessage });
                }
            });

            qwenProcess.on('error', (err) => {
                console.error(`[${projectName}] Error al iniciar Qwen:`, err);
                socket.emit('agentMessage', { type: 'error', data: `Error al ejecutar qwen: ${err.message}` });
            });
            
            qwenProcess.stdin.write(data.message + '\n');
            qwenProcess.stdin.end();
        });

        socket.on('stopChat', () => {
             // projectConfig = {}; // <--- CORRECCIÓN: Eliminamos esta línea que causaba un error
             projectPath = '';
             projectName = '';
             console.log('Chat detenido y configuración limpiada.');
        });

        // Es buena práctica manejar la desconexión también
        socket.on('disconnect', () => {
            console.log('Usuario desconectado:', socket.id);
            // No hay un proceso persistente que matar, así que solo limpiamos las variables de sesión
            projectPath = '';
            projectName = '';
        });
    });
}