import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'src/db/qwen-data.db');

async function openDb() {
    try {
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // --- LÓGICA DE MIGRACIÓN AUTOMÁTICA ---
        // Verificamos si la tabla 'chats' tiene la columna 'api_key'.
        const columns = await db.all("PRAGMA table_info(chats)");
        const hasApiKeyColumn = columns.some(col => col.name === 'api_key');

        if (!hasApiKeyColumn) {
            console.warn('⚠️  Detectada estructura de base de datos antigua. Recreando la tabla "chats"...');
            await db.exec('DROP TABLE IF EXISTS chats');
        }
        // --- FIN DE LA LÓGICA DE MIGRACIÓN ---

        // Ahora, creamos la tabla con la seguridad de que si era vieja, ya no existe.
        await db.exec(`
            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_name TEXT NOT NULL,
                api_key TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // El índice ahora se creará sobre la tabla correcta.
        await db.exec(`
            CREATE INDEX IF NOT EXISTS idx_project_chat ON chats (api_key, project_name);
        `);
        
        console.log('✅ Conexión a la base de datos (solo para chats) exitosa y estructura verificada.');
        return db;

    } catch (error) {
        console.error('❌ Error fatal al abrir o configurar la base de datos:', error);
        process.exit(1);
    }
}

export const db = await openDb();