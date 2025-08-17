// /src/services/socketManager.js - VERSIÓN FINAL CON `execa`

import { execa } from 'execa'; // Importamos la nueva librería
import path from "path";
import { db } from "../db/database.js";

export function initializeSocketManager(io) {
  io.use((socket, next) => {
    const apiKey = socket.handshake.auth.apiKey;
    if (!apiKey) {
      return next(new Error("Authentication error: No API key provided."));
    }
    socket.apiKey = apiKey;
    next();
  });

  io.on("connection", (socket) => {
    console.log("Usuario conectado:", socket.id, "con API Key:", socket.apiKey);

    socket.on("userMessage", async (data) => {
      const { projectId, message } = data;
      if (!projectId || !message) {
        return socket.emit("agentError", { message: "Falta projectId o mensaje." });
      }
      const projectPath = path.join(process.cwd(), "workspaces", socket.apiKey, projectId);

      try {
        await db.run(
          "INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)",
          [projectId, socket.apiKey, "user", message]
        );

        const promptForQwen = message;
        socket.emit("agentMessage", { type: "start" });

        console.log("\n--- [QWEN-ENTRADA] ---> ENVIANDO AL AGENTE (vía execa):");
        console.log("==========================================");
        console.log(promptForQwen);
        console.log("==========================================");

        // --- INICIO DE LA NUEVA LÓGICA CON `execa` ---
        
        // Creamos el proceso. `execa` devuelve un proceso hijo que también es una promesa.
        const qwenProcess = execa("qwen", ["--yolo"], {
          cwd: projectPath,
          shell: true, // Mantenemos tu requisito
          env: { ...process.env }, // Heredamos el entorno
          input: promptForQwen, // Manera limpia de pasar datos a stdin
        });

        // Para el streaming en tiempo real, nos conectamos al stdout del proceso
        qwenProcess.stdout.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          process.stdout.write(`\n--- [QWEN-SALIDA] --->\n${chunkStr}\n<--- [FIN-SALIDA] ---\n`);
          socket.emit("agentMessage", { type: "chunk", data: chunkStr });
        });
        
        qwenProcess.stderr.on('data', (chunk) => {
            const errorChunk = chunk.toString();
            console.error("\n--- [QWEN-ERROR] --->", errorChunk);
        });

        // Usamos await para esperar a que el proceso termine. Esto reemplaza .on('close')
        const { stdout: finalOutput, stderr: finalError } = await qwenProcess;
        
        // El proceso ha terminado con éxito
        await db.run(
            "INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)",
            [projectId, socket.apiKey, "assistant", finalOutput.trim()]
        );
        // --- FIN DE LA NUEVA LÓGICA CON `execa` ---

      } catch (error) {
        // `execa` lanza un error muy descriptivo si el proceso falla (código de salida != 0)
        console.error("El proceso del agente falló:", error.message);
        const errorMessage = error.stderr || error.message; // `error.stderr` a menudo contiene el error real
        socket.emit("agentError", { message: errorMessage });
      } finally {
        // Este bloque se ejecuta siempre, tanto si hay éxito como si hay error
        socket.emit("agentMessage", { type: "end" });
      }
    });

    socket.on("disconnect", () => {
      console.log("Usuario desconectado:", socket.id);
    });
  });
}