import fs from 'fs/promises';
import path from 'path';

/**
 * Crea la estructura completa de un proyecto en el disco.
 * @param {object} projectData - Contiene apiKey, name, stack, description, etc.
 * @returns {Promise<boolean>} - True si tuvo éxito.
 */
export async function createProject(projectData) {
    const { apiKey, name, stack, description, litellmUrl, model } = projectData;
    const projectPath = path.join(process.cwd(), 'workspaces', apiKey, name);

    try {
        await fs.mkdir(projectPath, { recursive: true });

        const envContent = [
            `OPENAI_API_KEY="${apiKey}"`,
            `OPENAI_BASE_URL="${litellmUrl}"`,
            `OPENAI_MODEL="${model}"`
        ].join('\n');
        await fs.writeFile(path.join(projectPath, '.env'), envContent);

        const settingsContent = JSON.stringify({ sessionTokenLimit: 32000 }, null, 2);
        await fs.writeFile(path.join(projectPath, 'settings.json'), settingsContent);

        const qwenMdContent = `## Propósito del Proyecto: ${name}\n\n**Stack Tecnológico:** ${stack}\n\n**Descripción:**\n${description}`;
        await fs.writeFile(path.join(projectPath, 'QWEN.md'), qwenMdContent);

        console.log(`Proyecto '${name}' creado en disco exitosamente.`);
        return true;
    } catch (error) {
        console.error(`Error al crear la estructura del proyecto '${name}':`, error);
        return false;
    }
}

/**
 * Elimina el directorio completo de un proyecto.
 * @param {string} apiKey - API key del usuario.
 * @param {string} projectName - Nombre del proyecto a eliminar.
 * @returns {Promise<boolean>} - True si tuvo éxito.
 */
export async function deleteProject(apiKey, projectName) {
    const projectPath = path.join(process.cwd(), 'workspaces', apiKey, projectName);
    try {
        await fs.rm(projectPath, { recursive: true, force: true });
        console.log(`Directorio del proyecto '${projectName}' eliminado.`);
        return true;
    } catch (error) {
        console.error(`Error al eliminar el directorio del proyecto '${projectName}':`, error);
        return false;
    }
}

/**
 * Lista los nombres de los directorios de proyectos.
 * @param {string} apiKey - API key del usuario.
 * @returns {Promise<string[]>} - Array con los nombres de los proyectos.
 */
export async function listProjectsInWorkspace(apiKey) {
    const workspacePath = path.join(process.cwd(), 'workspaces', apiKey);
    try {
        const items = await fs.readdir(workspacePath, { withFileTypes: true });
        return items
            .filter(item => item.isDirectory())
            .map(dir => dir.name);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        console.error(`Error al listar proyectos en ${workspacePath}:`, error);
        return [];
    }
}