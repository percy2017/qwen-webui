import fs from "fs/promises";
import path from "path";
export async function createProject(projectData) {
  const { apiKey, name, stack, description, litellmUrl, model } = projectData;
  const projectPath = path.join(process.cwd(), "workspaces", apiKey, name);

  try {
    await fs.mkdir(projectPath, { recursive: true });

    const envContent = [
      `OPENAI_API_KEY="${apiKey}"`,
      `OPENAI_BASE_URL="${litellmUrl}"`,
      `OPENAI_MODEL="${model}"`,
    ].join("\n");
    await fs.writeFile(path.join(projectPath, ".env"), envContent);

    const settingsContent = JSON.stringify(
      {
        theme: "Default",
        selectedAuthType: "openai",
        mcpServers: {},
      },
      null,
      2
    );
    await fs.writeFile(
      path.join(projectPath, "settings.json"),
      settingsContent
    );

    const qwenMdContent = `
# 💻 Proyecto: ${name}

## 🎯 Objetivo Principal
${description}

## 🛠️ Stack Tecnológico
- ${stack
      .split(",")
      .map((s) => s.trim())
      .join("\n- ")}

## 📁 Estructura de Archivos Actual
\`\`\`
/
\`\`\`

---

## ✅ Tareas Completadas
*   Aún no se han completado tareas.

---

## 📝 Plan de Acción y Tareas Pendientes
- **Siguiente Tarea:**
  1.  Crear la estructura de archivos inicial basada en el stack tecnológico.

- **Ideas a Futuro (Backlog):**
  - Añadir nuevas funcionalidades según sea necesario.
`.trim();

    await fs.writeFile(path.join(projectPath, "QWEN.md"), qwenMdContent);

    console.log(
      `Proyecto '${name}' creado en disco exitosamente con el nuevo formato de QWEN.md.`
    );
    return true;
  } catch (error) {
    console.error(
      `Error al crear la estructura del proyecto '${name}':`,
      error
    );
    return false;
  }
}

export async function deleteProject(apiKey, projectName) {
  const projectPath = path.join(
    process.cwd(),
    "workspaces",
    apiKey,
    projectName
  );
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
    console.log(`Directorio del proyecto '${projectName}' eliminado.`);
    return true;
  } catch (error) {
    console.error(
      `Error al eliminar el directorio del proyecto '${projectName}':`,
      error
    );
    return false;
  }
}

export async function listProjectsInWorkspace(apiKey) {
  const workspacePath = path.join(process.cwd(), "workspaces", apiKey);
  try {
    const items = await fs.readdir(workspacePath, { withFileTypes: true });
    return items.filter((item) => item.isDirectory()).map((dir) => dir.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    console.error(`Error al listar proyectos en ${workspacePath}:`, error);
    return [];
  }
}
