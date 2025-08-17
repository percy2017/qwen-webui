import { execa } from "execa";
import path from "path";
import axios from "axios";
import fs from "fs";
import { db } from "../db/database.js";

/**
 * Analiza la salida en bruto de qwen y genera un resumen limpio de las acciones completadas.
 * @param {string} rawOutput - La salida completa de stdout de qwen.
 * @returns {string} - Un mensaje de resumen en formato Markdown.
 */
function generateSummaryFromQwenOutput(rawOutput) {
    const actions = [];
    
    // Patrón para encontrar archivos creados/modificados
    // Busca: ✅ Tool write_file completed successfully seguido de 📋 File: nombre.ext
    const writeFileRegex = /✅ Tool write_file completed successfully\s+📋 File: ([\w.-]+)/g;
    let match;
    while ((match = writeFileRegex.exec(rawOutput)) !== null) {
        actions.push(`**Archivo Creado/Modificado:** \`${match[1]}\``);
    }

    // Patrón para encontrar comandos de shell ejecutados
    if (/✅ Tool shell completed successfully/.test(rawOutput)) {
        actions.push("**Comando de terminal ejecutado.**");
    }
    
    // Si no se encontraron acciones pero el agente habló, buscar su respuesta final
    if (actions.length === 0) {
        const finalResponseMatch = rawOutput.match(/assistantfinal;([\s\S]*)/);
        if (finalResponseMatch) {
            return finalResponseMatch[1].trim();
        }
        // Si no hay acciones ni respuesta final, es un resultado inesperado.
        return "La tarea se completó sin acciones explícitas o respuesta final.";
    }

    // Construir el mensaje de resumen final
    const summaryHeader = "¡Tarea completada! Se realizaron las siguientes acciones:";
    const summaryBody = actions.map(action => `*   ${action}`).join('\n');
    return `${summaryHeader}\n\n${summaryBody}`;
}


export function initializeSocketManager(io) {
    io.use((socket, next) => {
        const apiKey = socket.handshake.auth.apiKey;
        if (!apiKey) return next(new Error("Authentication error"));
        socket.apiKey = apiKey;
        next();
    });

    io.on("connection", (socket) => {
        console.log("Usuario conectado:", socket.id);
        
        socket.on("userMessage", async (data) => {
            const { projectName, message, agentMode } = data;
            if (!projectName || !message) {
                return socket.emit("agentError", { message: "Falta projectName o mensaje." });
            }
            const projectPath = path.join(process.cwd(), "workspaces", socket.apiKey, projectName);
            
            try {
                await db.run("INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)", [projectName, socket.apiKey, "user", message]);
                socket.emit("agentMessage", { type: "start" });

                if (agentMode === 'Programmer') {
                    // --- MODO PROGRAMADOR: EJECUTAR, ANALIZAR Y RESUMIR ---
                    console.log(`[Modo Programador] Ejecutando qwen para: ${projectName}`);
                    
                    const qwenProcess = execa("qwen", ["--yolo"], {
                        cwd: projectPath, shell: true, input: message
                    });
                    
                    let rawOutput = "";
                    qwenProcess.stdout.on('data', (chunk) => rawOutput += chunk.toString());
                    qwenProcess.stderr.on('data', (chunk) => console.error("\n--- [QWEN-ERROR-STREAM] --->", chunk.toString()));

                    await qwenProcess; // Esperar a que el proceso termine
                    console.log(`\n--- [QWEN-SALIDA-BRUTA] --->\n${rawOutput}\n<--- [FIN-SALIDA-BRUTA] ---\n`);

                    const summaryMessage = generateSummaryFromQwenOutput(rawOutput);
                    console.log(`\n--- [RESUMEN-GENERADO] --->\n${summaryMessage}\n<--- [FIN-RESUMEN] ---\n`);

                    // Enviar el resumen limpio al cliente
                    socket.emit("agentMessage", { type: "chunk", data: summaryMessage });
                    // Guardar el resumen limpio en la base de datos
                    await db.run("INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)", [projectName, socket.apiKey, "assistant", summaryMessage.trim()]);
                    // Enviar señal para refrescar el explorador de archivos
                    socket.emit("refreshExplorer");

                } else {
                    // --- MODO ARQUITECTO: CONVERSACIÓN DIRECTA ---
                    console.log(`[Modo Arquitecto] Consultando a LiteLLM para: ${projectName}`);
                    
                    const envPath = path.join(projectPath, '.env');
                    const envContent = fs.readFileSync(envPath, 'utf-8');
                    const config = Object.fromEntries(envContent.split('\n').filter(Boolean).map(line => line.split('=').map(part => part.trim().replace(/"/g, ''))));
                    
                    const qwenMdPath = path.join(projectPath, 'QWEN.md');
                    const qwenMdContent = fs.readFileSync(qwenMdPath, 'utf-8');
                    
                    const systemMessage = {
                        role: "system",
                        content: `Eres un asistente experto en desarrollo de software. Este es el estado y objetivo del proyecto actual:\n\n---\n${qwenMdContent}\n---\n\nTu tarea es conversar con el usuario para refinar el plan. Responde de forma concisa y útil.`
                    };

                    const history = await db.all('SELECT role, content FROM chats WHERE project_name = ? AND api_key = ? ORDER BY timestamp ASC', [projectName, socket.apiKey]);
                    const userHistoryMessages = history.map(msg => ({ role: msg.role, content: msg.content }));
                    
                    const messages = [systemMessage, ...userHistoryMessages];
                    
                    const response = await axios.post(`${config.OPENAI_BASE_URL}/chat/completions`, {
                        model: config.OPENAI_MODEL, messages: messages
                    }, {
                        headers: { 'Authorization': `Bearer ${config.OPENAI_API_KEY}` }
                    });
                    
                    const assistantResponse = response.data.choices[0].message.content;

                    socket.emit("agentMessage", { type: "chunk", data: assistantResponse });
                    await db.run("INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)", [projectName, socket.apiKey, "assistant", assistantResponse]);
                }

            } catch (error) {
                const errorMessage = error.stderr || error.message;
                console.error("El proceso del agente falló:", errorMessage);
                socket.emit("agentError", { message: errorMessage });
            } finally {
                socket.emit("agentMessage", { type: "end" });
            }
        });

        socket.on("disconnect", () => {
            console.log("Usuario desconectado:", socket.id);
        });
    });
}