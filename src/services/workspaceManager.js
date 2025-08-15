import fs from 'fs/promises';
import path from 'path';

export async function ensureWorkspaceExists(apiKey) {
    const workspacePath = path.join(process.cwd(), 'workspaces', apiKey);
    try {
        await fs.mkdir(workspacePath, { recursive: true });
        console.log(`Workspace creado exitosamente: ${workspacePath}`);
        return true;
    } catch (error) {
        console.error(`Error al crear workspace ${workspacePath}:`, error);
        return false;
    }
}

export async function createProjectDirectory(apiKey, projectName) {
    const workspacePath = path.join(process.cwd(), 'workspaces', apiKey);
    const projectPath = path.join(workspacePath, projectName);
    
    try {
        console.log('Creando proyecto en:', projectPath);
        
        // Crear workspace y proyecto en una sola operación
        await fs.mkdir(projectPath, { recursive: true });
        console.log(`Proyecto creado exitosamente: ${projectPath}`);
        return true;
    } catch (error) {
        console.error(`Error al crear proyecto ${projectPath}:`, error);
        return false;
    }
}

export async function listProjectsInWorkspace(apiKey) {
    const workspacePath = path.join(process.cwd(), 'workspaces', apiKey);
    try {
        const items = await fs.readdir(workspacePath, { withFileTypes: true });
        const projects = items
            .filter(item => item.isDirectory())
            .map(dir => dir.name);
        return projects;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`El workspace ${workspacePath} no existe. No hay proyectos.`);
            return [];
        }
        console.error(`Error al listar proyectos en ${workspacePath}:`, error);
        return [];
    }
}