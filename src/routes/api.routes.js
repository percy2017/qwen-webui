import express from 'express';
import axios from 'axios';
import { db } from '../db/database.js';
import { createProject, deleteProject, listProjectsInWorkspace } from '../services/workspaceManager.js';
import fs from 'fs/promises';
import path from 'path';
import dirTree from 'directory-tree';

const router = express.Router();

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No autorizado.' });
    }
    req.apiKey = authHeader.substring(7);
    next();
};

router.get('/models', async (req, res) => {
    const { litellmUrl, apiKey } = req.query;
    if (!litellmUrl || !apiKey) return res.status(400).json({ success: false, message: "LiteLLM URL y API Key son requeridos." });
    try {
        const response = await axios.get(`${litellmUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
        res.json({ success: true, models: response.data.data });
    } catch (error) {
        res.status(500).json({ success: false, message: "No se pudieron obtener los modelos." });
    }
});

router.get('/projects', authenticate, async (req, res) => {
    try {
        const projectNames = await listProjectsInWorkspace(req.apiKey);
        const projectsDetails = await Promise.all(projectNames.map(async (name, index) => {
            const projectPath = path.join(process.cwd(), 'workspaces', req.apiKey, name);
            const qwenMdPath = path.join(projectPath, 'QWEN.md');
            let stack = "No definido";
            let description = "Sin descripción";
            try {
                const content = await fs.readFile(qwenMdPath, 'utf-8');
                const stackMatch = content.match(/\*\*Stack Tecnológico:\*\*\s*(.*)/);
                const descMatch = content.match(/\*\*Descripción:\*\*\s*([\s\S]*)/);
                if (stackMatch) stack = stackMatch[1].trim();
                if (descMatch) description = descMatch[1].trim();
            } catch (e) {}
            return { id: index, name, stack, description };
        }));
        res.json({ success: true, projects: projectsDetails });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al obtener proyectos." });
    }
});

router.get('/projects/:name/files', authenticate, async (req, res) => {
    const { name } = req.params;
    try {
        const projectPath = path.join(process.cwd(), 'workspaces', req.apiKey, name);
        const tree = dirTree(projectPath, {
            // exclude: /\.env/,
            normalizePath: true,
        });
        if (!tree) {
            return res.json([]);
        }
        res.json(tree.children);
    } catch (error) {
        console.error(`Error al generar el árbol de archivos para ${name}:`, error);
        res.status(500).json({ success: false, message: 'Error al obtener la estructura de archivos.' });
    }
});

router.post('/projects', authenticate, async (req, res) => {
    const { name, stack, description, litellmUrl, model } = req.body;
    if (!name || !stack || !description || !litellmUrl || !model) {
        return res.status(400).json({ success: false, message: "Faltan datos." });
    }
    const projectPath = path.join(process.cwd(), 'workspaces', req.apiKey, name);
    try {
        await fs.access(projectPath);
        return res.status(409).json({ success: false, message: 'Ya existe un proyecto con ese nombre.' });
    } catch (error) {}
    const projectData = { apiKey: req.apiKey, name, stack, description, litellmUrl, model };
    const success = await createProject(projectData);
    if (success) {
        res.status(201).json({ success: true, message: 'Proyecto creado correctamente.' });
    } else {
        res.status(500).json({ success: false, message: 'Error al crear la estructura de archivos del proyecto.' });
    }
});

router.delete('/projects/:name', authenticate, async (req, res) => {
    const { name } = req.params;
    try {
        await db.run('DELETE FROM chats WHERE api_key = ? AND project_name = ?', [req.apiKey, name]);
        await deleteProject(req.apiKey, name);
        res.json({ success: true, message: 'Proyecto eliminado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

router.get('/projects/:name/chat', authenticate, async (req, res) => {
    const { name } = req.params;
    try {
        const history = await db.all('SELECT role, content FROM chats WHERE api_key = ? AND project_name = ? ORDER BY timestamp ASC', [req.apiKey, name]);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener historial.' });
    }
});

router.get('/projects/:name/info', authenticate, async (req, res) => {
    const { name } = req.params;
    try {
        const projectPath = path.join(process.cwd(), 'workspaces', req.apiKey, name);
        const envPath = path.join(projectPath, '.env');
        let envConfig = {};
        try {
            const envContent = await fs.readFile(envPath, 'utf-8');
            envContent.split('\n').forEach(line => {
                const [key, ...values] = line.split('=');
                if (key && values.length > 0) envConfig[key.trim()] = values.join('=').replace(/"/g, '').trim();
            });
        } catch (error) {}
        res.json({ success: true, envConfig });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener información.' });
    }
});

router.put('/projects/:name/config', authenticate, async (req, res) => {
    const { name } = req.params;
    const { litellmUrl, selectedModel } = req.body;
    if (!litellmUrl || !selectedModel) {
        return res.status(400).json({ success: false, message: 'Faltan datos.' });
    }
    try {
        const projectPath = path.join(process.cwd(), 'workspaces', req.apiKey, name);
        const envPath = path.join(projectPath, '.env');
        const envContent = [`OPENAI_API_KEY="${req.apiKey}"`, `OPENAI_BASE_URL="${litellmUrl}"`, `OPENAI_MODEL="${selectedModel}"`].join('\n');
        await fs.writeFile(envPath, envContent, 'utf-8');
        res.json({ success: true, message: 'Configuración actualizada.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar.' });
    }
});

router.get('/user/info', authenticate, async (req, res) => {
    const { litellmUrl } = req.query;
    if (!litellmUrl) {
        return res.status(400).json({ success: false, message: "La URL de LiteLLM es requerida." });
    }
    try {
        const response = await axios.get(`${litellmUrl}/key/info`, {
            headers: { 
                'Authorization': `Bearer ${req.apiKey}` 
            }
        });
        res.json({ success: true, data: response.data });

    } catch (error) {
        console.error('Error al obtener la información del usuario desde LiteLLM:', error.message);
        res.status(500).json({ 
            success: false, 
            message: "No se pudo obtener la información del usuario desde LiteLLM." 
        });
    }
});

router.post('/projects/:name/file-content', authenticate, async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return res.status(400).json({ success: false, message: 'La ruta del archivo es requerida.' });
    }

    try {
        const projectPath = path.join(process.cwd(), 'workspaces', req.apiKey, req.params.name);
        if (!path.resolve(filePath).startsWith(path.resolve(projectPath))) {
            return res.status(403).json({ success: false, message: 'Acceso denegado al archivo.' });
        }
        const content = await fs.readFile(filePath, 'utf-8');
        res.type('text/plain').send(content);

    } catch (error) {
        console.error(`Error al leer el archivo ${filePath}:`, error);
        res.status(404).json({ success: false, message: 'No se pudo encontrar o leer el archivo.' });
    }
});


router.post('/projects/:name/save-file', authenticate, async (req, res) => {
    const { filePath, content } = req.body;

    if (filePath === undefined || content === undefined) {
        return res.status(400).json({ success: false, message: 'La ruta y el contenido del archivo son requeridos.' });
    }

    try {
        // Por seguridad, verificamos de nuevo que el archivo pertenezca al workspace del usuario.
        const projectPath = path.join(process.cwd(), 'workspaces', req.apiKey, req.params.name);
        if (!path.resolve(filePath).startsWith(path.resolve(projectPath))) {
            return res.status(403).json({ success: false, message: 'Acceso denegado para escribir en esta ruta.' });
        }

        // Escribimos el nuevo contenido en el archivo.
        await fs.writeFile(filePath, content, 'utf-8');
        
        res.json({ success: true, message: `Archivo ${path.basename(filePath)} guardado correctamente.` });

    } catch (error) {
        console.error(`Error al guardar el archivo ${filePath}:`, error);
        res.status(500).json({ success: false, message: 'No se pudo guardar el archivo.' });
    }
});


export default router;