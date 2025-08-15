import express from 'express';
import axios from 'axios';

const router = express.Router();

// Middleware para asegurar respuestas JSON
router.use((req, res, next) => {
    res.json = function(data) {
        console.log('DEBUG auth.routes.js: Enviando respuesta JSON:', data);
        res.setHeader('Content-Type', 'application/json');
        return express.response.json.call(this, data);
    };
    next();
});

// Ruta para "conectar" (login)
router.post('/', async (req, res) => {
    console.log('DEBUG auth.routes.js: Solicitud POST /connect recibida.');
    console.log('DEBUG auth.routes.js: req.body:', req.body);
    
    try {
        const { apiKey, litellmUrl } = req.body;
        console.log('DEBUG auth.routes.js: apiKey y litellmUrl:', { apiKey, litellmUrl });

        if (!apiKey || !litellmUrl) {
            console.log('DEBUG auth.routes.js: Faltan apiKey o litellmUrl.');
            return res.status(400).json({ success: false, message: 'API Key y LiteLLM URL son requeridos.' });
        }

        try {
            // Verificar la API Key con LiteLLM
            console.log('DEBUG auth.routes.js: Verificando API Key con LiteLLM...');
            const response = await axios.get(`${litellmUrl}/key/info`, {
                headers: {
                    'x-litellm-api-key': apiKey,
                    'accept': 'application/json'
                }
            });

            console.log('DEBUG auth.routes.js: Respuesta de LiteLLM:', response.status);

            if (response.status === 200) {
                console.log('DEBUG auth.routes.js: API Key válida. Enviando respuesta JSON de éxito.');
                res.json({ success: true, redirectUrl: '/dashboard' });
            } else {
                console.log('DEBUG auth.routes.js: API Key inválida. Status:', response.status);
                res.status(401).json({ success: false, message: 'API Key inválida o URL incorrecta.' });
            }

        } catch (error) {
            console.error('DEBUG auth.routes.js: Error en la autenticación:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                res.status(401).json({ success: false, message: 'API Key inválida.' });
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                res.status(400).json({ success: false, message: 'No se pudo conectar a la URL de LiteLLM.' });
            } else {
                res.status(500).json({ success: false, message: 'Error interno del servidor.' });
            }
        }
    } catch (error) {
        console.error('DEBUG auth.routes.js: Error no manejado:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

export default router;