import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Página de login
router.get('/', (req, res) => {
    res.render('login');
});

// Dashboard principal
router.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

export default router;