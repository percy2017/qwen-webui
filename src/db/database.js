import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'qwen-data.db');

// Usar verbose para ver las consultas SQL en la consola durante el desarrollo
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Tabla de chats (historial de conversaciones)
        db.run(`
            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_path TEXT NOT NULL,
                history TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error al crear la tabla chats:', err.message);
            } else {
                console.log('Tabla "chats" verificada/creada.');
            }
        });
    });
}

export default db;