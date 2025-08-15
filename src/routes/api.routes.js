import express from "express";
import axios from "axios";
import {
  createProjectDirectory,
  listProjectsInWorkspace,
} from "../services/workspaceManager.js";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// GET /api/models - Obtener modelos disponibles desde LiteLLM
router.get("/models", async (req, res) => {
  const { litellmUrl, apiKey } = req.query;

  if (!litellmUrl || !apiKey) {
    return res.status(400).json({
      success: false,
      message: "LiteLLM URL y API Key son requeridos.",
    });
  }

  try {
    const response = await axios.get(`${litellmUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error(
      "Error al obtener modelos de LiteLLM:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({ success: false, message: "No se pudieron obtener los modelos." });
  }
});

// GET /api/projects - Obtener todos los proyectos del usuario
router.get("/projects", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "No autorizado." });
    }

    const apiKey = authHeader.substring(7);
    const projectNames = await listProjectsInWorkspace(apiKey);
    const workspacePath = path.join(process.cwd(), "workspaces", apiKey);

    // Usamos Promise.all para leer los detalles de todos los proyectos en paralelo
    const projectsFormatted = await Promise.all(
      projectNames.map(async (name, index) => {
        const projectPath = path.join(workspacePath, name);
        const qwenMdPath = path.join(projectPath, "QWEN.md");

        let stack = "No definido";
        let description = "Sin descripción.";

        try {
          const content = await fs.readFile(qwenMdPath, "utf-8");

          // Expresiones regulares para extraer los datos del archivo QWEN.md
          const stackMatch = content.match(
            /### Stack Tecnológico\s*([\s\S]*?)\s*###/
          );
          const descMatch = content.match(
            /### Descripción Detallada\s*([\s\S]*?)\s*###/
          );

          if (stackMatch && stackMatch[1]) {
            stack = stackMatch[1].trim();
          }
          if (descMatch && descMatch[1]) {
            description = descMatch[1].trim();
          }
        } catch (error) {
          console.warn(`No se pudo leer QWEN.md para el proyecto ${name}`);
        }

        return {
          id: index + 1, // El ID sigue siendo temporal para la UI
          name,
          stack,
          description,
        };
      })
    );

    res.json({ success: true, projects: projectsFormatted });
  } catch (error) {
    console.error("Error al obtener proyectos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener proyectos." });
  }
});
// POST /api/projects - Crear un nuevo proyecto
router.post("/projects", async (req, res) => {
  try {
    const { name, stack, description, apiKey, litellmUrl } = req.body;

    if (!name || !stack || !description || !apiKey || !litellmUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan datos obligatorios." });
    }

    // Crear directorio del proyecto
    const projectCreated = await createProjectDirectory(apiKey, name);
    if (!projectCreated) {
      return res.status(500).json({
        success: false,
        message: "Error al crear el directorio del proyecto.",
      });
    }

    const projectPath = path.join(process.cwd(), "workspaces", apiKey, name);

    // --- ¡CAMBIO AQUÍ! ---
    // Contenido del .env sin espacios extra al principio de las líneas.
    const envContent = [
      `OPENAI_API_KEY="${apiKey}"`,
      `OPENAI_BASE_URL="${litellmUrl}"`,
      `OPENAI_MODEL="all-team-models"`,
    ].join("\n");

    const settingsContent = JSON.stringify(
      {
        theme: "Qwen Dark",
        selectedAuthType: "openai",
        mcpServers: {},
      },
      null,
      2
    );

    const memoryContent = `## Contexto del Proyecto

### Nombre del Proyecto
${name}

### Stack Tecnológico
${stack}

### Descripción Detallada
${description}`;

    await fs.writeFile(path.join(projectPath, ".env"), envContent, "utf-8");
    await fs.writeFile(
      path.join(projectPath, "settings.json"),
      settingsContent,
      "utf-8"
    );
    await fs.writeFile(
      path.join(projectPath, "QWEN.md"),
      memoryContent,
      "utf-8"
    );

    res.json({ success: true, message: "Proyecto creado correctamente." });
  } catch (error) {
    console.error("Error al crear proyecto:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al crear proyecto.",
    });
  }
});
// DELETE /api/projects/:name - Eliminar un proyecto
router.delete("/projects/:name", async (req, res) => {
  try {
    const projectName = req.params.name;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No autorizado. Se requiere API Key.",
      });
    }
    const apiKey = authHeader.substring(7);
    const projectPath = path.join(
      process.cwd(),
      "workspaces",
      apiKey,
      projectName
    );

    // Verificar que el directorio exista
    try {
      await fs.access(projectPath);
    } catch {
      return res
        .status(404)
        .json({ success: false, message: "Proyecto no encontrado." });
    }

    // Eliminar el directorio del proyecto
    await fs.rm(projectPath, { recursive: true, force: true });

    res.json({ success: true, message: "Proyecto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar proyecto:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al eliminar proyecto.",
    });
  }
});

// PUT /api/projects/:name/config - Actualizar configuración del proyecto (LLM, etc.)
router.put("/projects/:name/config", async (req, res) => {
  try {
    const projectName = req.params.name;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "No autorizado." });
    }
    const apiKey = authHeader.substring(7);

    const { litellmUrl, selectedModel } = req.body;

    if (!litellmUrl || !selectedModel) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan datos obligatorios." });
    }

    const projectPath = path.join(
      process.cwd(),
      "workspaces",
      apiKey,
      projectName
    );
    const envPath = path.join(projectPath, ".env");

    // --- ¡CAMBIO AQUÍ! ---
    // Actualizar el archivo .env con los nuevos datos, sin espacios extra.
    const envContent = [
      `OPENAI_API_KEY="${apiKey}"`,
      `OPENAI_BASE_URL="${litellmUrl}"`,
      `OPENAI_MODEL="${selectedModel}"`,
    ].join("\n");

    await fs.writeFile(envPath, envContent, "utf-8");

    res.json({
      success: true,
      message: "Configuración del proyecto actualizada correctamente.",
    });
  } catch (error) {
    console.error("Error al actualizar configuración del proyecto:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al actualizar configuración.",
    });
  }
});

// GET /api/projects/:name/info - Obtener información del proyecto
router.get("/projects/:name/info", async (req, res) => {
  try {
    const projectName = req.params.name;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No autorizado. Se requiere API Key.",
      });
    }

    const apiKey = authHeader.substring(7);

    // Obtener información del proyecto
    const projectPath = path.join(
      process.cwd(),
      "workspaces",
      apiKey,
      projectName
    );

    // Leer .env para obtener configuración
    const envPath = path.join(projectPath, ".env");
    let envConfig = {};
    try {
      const envContent = await fs.readFile(envPath, "utf-8");
      envContent.split("\n").forEach((line) => {
        const [key, ...values] = line.split("=");
        if (key && values.length > 0) {
          envConfig[key.trim()] = values.join("=").replace(/"/g, "").trim();
        }
      });
    } catch (error) {
      console.warn("No se pudo leer .env:", error.message);
    }

    // Leer QWEN.md para obtener contexto
    let qwenContext = "";
    try {
      const qwenPath = path.join(projectPath, "QWEN.md");
      qwenContext = await fs.readFile(qwenPath, "utf-8");
    } catch (error) {
      console.warn("No se pudo leer QWEN.md:", error.message);
    }

    res.json({
      success: true,
      project: {
        name: projectName,
        envConfig: envConfig,
        qwenContext: qwenContext,
      },
    });
  } catch (error) {
    console.error("Error al obtener información del proyecto:", error);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor." });
  }
});

export default router;
