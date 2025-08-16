import express from 'express';
import axios from 'axios';
import { db } from '../db/database.js';
import { createProject, deleteProject, listProjectsInWorkspace } from '../services/workspaceManager.js';
import fs from 'fs/promises';
import path from 'path';

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
    // La API Key del usuario ya está en req.apiKey gracias al middleware
    const { litellmUrl } = req.query;

    if (!litellmUrl) {
        return res.status(400).json({ success: false, message: "La URL de LiteLLM es requerida." });
    }

    try {
        // Hacemos una petición al endpoint /key/info de LiteLLM, usando la API key del usuario
        const response = await axios.get(`${litellmUrl}/key/info`, {
            headers: { 
                'Authorization': `Bearer ${req.apiKey}` 
            }
        });
        
        // Enviamos la respuesta de LiteLLM de vuelta al frontend
        res.json({ success: true, data: response.data });

    } catch (error) {
        console.error('Error al obtener la información del usuario desde LiteLLM:', error.message);
        res.status(500).json({ 
            success: false, 
            message: "No se pudo obtener la información del usuario desde LiteLLM." 
        });
    }
});



export default router;