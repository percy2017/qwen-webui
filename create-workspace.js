import fs from 'fs/promises';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const workspacesPath = path.join(__dirname, 'workspaces');

async function createWorkspacesDirectory() {
    try {
        await fs.mkdir(workspacesPath, { recursive: true });
        console.log('Directorio workspaces creado exitosamente:', workspacesPath);
    } catch (error) {
        console.error('Error al crear directorio workspaces:', error);
    }
}

createWorkspacesDirectory();