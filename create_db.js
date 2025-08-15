import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
// __dirname en este caso será la raíz del proyecto si ejecutas `node create_db.js`
const __dirname = path.dirname(__filename); 
const dbPath = path.join(__dirname, 'src', 'db', 'qwen-data.db');

console.log('Verificando y configurando la base de datos en:', dbPath);

// Asegurarse de que el directorio de la DB exista
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Directorio de base de datos creado en: ${dbDir}`);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error('Error al abrir la base de datos:', err.message);
    }
    console.log('\u2705 Conexión a la base de datos SQLite exitosa.');
});

db.serialize(() => {
    // La única tabla que necesitamos: un registro de mensajes de chat.
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_path TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) return console.error('Error al crear tabla messages:', err.message);
        console.log('\u2705 Tabla "messages" para el historial de chat verificada.');
    });

    // Opcional: Crear un índice para acelerar las búsquedas de historial por proyecto
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_project_path ON messages (project_path);
    `, (err) => {
        if (err) return console.error('Error al crear índice:', err.message);
        console.log('\u2705 Índice para "project_path" verificado.');
    });
});

db.close((err) => {
    if (err) {
        return console.error('Error al cerrar la base de datos:', err.message);
    }
    console.log('\u2705 Configuración de la base de datos completada. Conexión cerrada.');
});

// Nota: Necesitas importar 'fs' para que mkdirSync funcione
import fs from 'fs';