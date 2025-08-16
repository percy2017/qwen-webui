import { spawn } from "child_process";
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
        return socket.emit("agentError", {
          message: "Falta projectId o mensaje.",
        });
      }
      const projectPath = path.join(
        process.cwd(),
        "workspaces",
        socket.apiKey,
        projectId
      );

      try {
        await db.run(
          "INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)",
          [projectId, socket.apiKey, "user", message]
        );
        const history = await db.all(
          "SELECT role, content FROM chats WHERE project_name = ? AND api_key = ? ORDER BY timestamp DESC LIMIT 10",
          [projectId, socket.apiKey]
        );
        const fullPrompt = history
          .reverse()
          .map(
            (msg) =>
              `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
          )
          .join("\n");

        socket.emit("agentMessage", { type: "start" });

        const qwenProcess = spawn("qwen", ["--yolo"], {
          cwd: projectPath,
          shell: true,
        });
        let fullResponse = "";
        let fullError = "";
        let errorHandled = false; // Flag para evitar dobles errores

        qwenProcess.stdout.on("data", (chunk) => {
          const chunkStr = chunk.toString();

          // --- LÍNEA AÑADIDA PARA DEPURAR ---
          console.log("--- DATO CRUDO RECIBIDO ---:", chunkStr);

          // Detectar si el chunk de stdout es en realidad un error
          if (
            chunkStr.includes("[API Error:") ||
            chunkStr.includes("litellm.UnsupportedParamsError")
          ) {
            errorHandled = true;
            socket.emit("agentError", { message: chunkStr });
            socket.emit("agentMessage", { type: "end" });
            qwenProcess.kill();
            return;
          }

          fullResponse += chunkStr;
          socket.emit("agentMessage", { type: "chunk", data: chunkStr });
        });

        qwenProcess.stderr.on("data", (chunk) => {
          fullError += chunk.toString();
        });

        qwenProcess.on("close", async (code) => {
          if (errorHandled) return; // Si ya manejamos el error, no hacer nada más

          const trimmedResponse = fullResponse.trim();
          if (code === 0 && trimmedResponse) {
            await db.run(
              "INSERT INTO chats (project_name, api_key, role, content) VALUES (?, ?, ?, ?)",
              [projectId, socket.apiKey, "assistant", trimmedResponse]
            );
          } else if (code !== 0) {
            // Solo emitir error si el código es distinto de 0
            const errorMessage =
              fullError ||
              `El agente finalizó inesperadamente con código ${code}.`;
            socket.emit("agentError", { message: errorMessage });
          }
          socket.emit("agentMessage", { type: "end" });
        });

        qwenProcess.on("error", (err) => {
          if (errorHandled) return;
          errorHandled = true;
          socket.emit("agentError", {
            message: `Error al ejecutar el agente: ${err.message}`,
          });
        });

        qwenProcess.stdin.write(fullPrompt + "\n");
        qwenProcess.stdin.end();
      } catch (error) {
        socket.emit("agentError", {
          message: `Error interno del servidor: ${error.message}`,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Usuario desconectado:", socket.id);
    });
  });
}
