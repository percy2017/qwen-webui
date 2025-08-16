# 🤖 Agente de Codificación Web (Proyecto: Qwen-Web-Agent)

**Un entorno de desarrollo web interactivo y auto-alojado, potenciado por el agente de codificación `qwen` y modelos de lenguaje personalizables a través de LiteLLM.**

Este proyecto lleva la experiencia de un agente de codificación autónomo, capaz de interactuar con un sistema de archivos, a una interfaz web limpia y en tiempo real. Permite la configuración detallada de modelos de IA, la creación de proyectos aislados y una interacción fluida para el desarrollo de código asistido por IA.

---

## 🏛️ Filosofía y Arquitectura Central

1.  **Aislamiento y Control:** La arquitectura está diseñada para un entorno multi-usuario y multi-proyecto. Cada proyecto vive en su propio directorio aislado, con su propia configuración (`.env`, `settings.json`) y memoria (`QWEN.md`).

2.  **El Backend como Orquestador Inteligente:** El servidor Express.js actúa como el "cerebro", gestionando la UI (rutas, vistas) y orquestando la interacción entre la base de datos de la interfaz y el agente de IA.

3.  **El Agente `qwen` como Herramienta Efímera ("One-Shot"):** Tratamos al CLI de `qwen` como una herramienta potente pero sin estado en cada ejecución. Se invoca para una tarea, se le proporciona todo el contexto que necesita vía `stdin`, y luego el proceso termina. Esto asegura un sistema predecible, seguro y sin fugas de memoria, ideal para un entorno web.

4.  **Experiencia en Tiempo Real:** La comunicación con el agente se realiza mediante streaming a través de Socket.IO, renderizando las respuestas con formato Markdown en tiempo real para una experiencia de usuario fluida.

5.  **Separación Clara de Memorias:** El sistema distingue tres tipos de "memoria" con roles muy definidos.

---

## 📂 Roles de los Componentes Clave

| Componente | Rol | Quién lo Gestiona |
| :--- | :--- | :--- |
| **Base de Datos SQLite** | **Memoria de la Interfaz de Usuario (UI)** | **Nuestro Backend.** Guarda el historial del chat para poder mostrarlo en pantalla. Es el registro persistente de la conversación. |
| **`stdin` del Proceso `qwen`**| **Contexto de la Conversación Actual** | **Nuestro Backend.** Antes de cada llamada, el backend lee la DB, formatea el historial reciente y se lo pasa al agente a través de este canal. |
| **Archivo `QWEN.md`** | **Manual de Instrucciones del Agente** | **Nosotros (al inicio) y luego el Agente `qwen`.** Lo creamos con el "propósito" del proyecto. El agente lo lee en cada ejecución y lo puede modificar con comandos como `/memory` para guardar notas a largo plazo. |

---

## 📁 Estructura Detallada del Proyecto

```
/qwen-web-agent/
│
├── 📁 workspaces/
│   └── 📁 [apiKey]/                # Directorio del usuario, identificado por su API Key.
│       └── 📁 [projectName]/       # Directorio aislado para cada proyecto.
│           ├── .env                # Configuración de API para este proyecto (leído por qwen).
│           ├── settings.json       # Configuración específica del proyecto (leído por qwen).
│           └── QWEN.md             # Manual de Instrucciones y Memoria a largo plazo del agente.
│
├── 📁 src/
│   ├── 📁 public/                 # Archivos estáticos del cliente.
│   │   ├── css/style.css
│   │   └── js/ (api.js, auth.js, dashboard.js, main.js, ui.js)
│   │
│   ├── 📁 views/                  # Plantillas EJS.
│   │   ├── partials/ (header.ejs, footer.ejs, modales...)
│   │   └── (login.ejs, dashboard.ejs)
│   │
│   ├── 📁 routes/                 # Definición de rutas Express.
│   │   └── api.routes.js
│   │
│   ├── 📁 services/
│   │   ├── socketManager.js    # Lógica central: Orquesta la interacción con qwen.
│   │   └── workspaceManager.js # Utilidades para crear/eliminar la estructura de archivos.
│   │
│   ├── 📁 db/
│   │   ├── database.js         # Configuración e inicialización de SQLite.
│   │   └── qwen-data.db        # Archivo de la base de datos (solo para historial de UI).
│   │
│   └── server.js               # Punto de entrada de la aplicación.
│
├── package.json
└── README.md
```

---

## 🛠️ Stack y Herramientas

*   **Backend:** Node.js, Express.js, Socket.IO
*   **Frontend:** Vanilla JS, Bootstrap 5, EJS, Marked.js, Highlight.js
*   **Base de Datos:** SQLite (`sqlite` y `sqlite3`)
*   **Agente de IA:** `qwen` CLI
*   **Proxy de Modelos:** `LiteLLM`

---

## 🎯 Estado Actual y Próximos Pasos

### Estado Actual
El sistema es funcional. La arquitectura está completamente implementada, permitiendo la creación de proyectos y la interacción en tiempo real con el agente `qwen` a través de la interfaz web. Todos los errores de desincronización y de base de datos han sido resueltos.

### Próximos Pasos
Nuestra prioridad es mejorar la interacción del agente con el entorno del proyecto.

1.  **PRIORIDAD 1: Explorador de Archivos (Estilo VS Code):**
    *   **Objetivo:** Crear un nuevo panel en el sidebar (o en el panel derecho) que muestre el árbol de archivos y directorios del `workspace` del proyecto actualmente seleccionado.
    *   **Interacción:** Al hacer clic en un archivo del árbol, su ruta relativa (ej: `@src/index.js`) se debe insertar automáticamente en el `textarea` del chat, para facilitar la inclusión de archivos en el contexto del agente.

2.  **Soporte para Comandos `/`:** Implementar una lógica en el frontend para que, si el usuario escribe un comando como `/stats`, este se pase directamente al `stdin` del agente para que `qwen` lo interprete y devuelva el resultado.

3.  **Gestión de Archivos (Upload):** Implementar la funcionalidad del botón "Adjuntar Archivo" para permitir al usuario subir archivos directamente al `workspace` del proyecto.

---

### Análisis del Próximo Paso: Explorador de Archivos

Para implementar el explorador de archivos, necesitaremos:

*   **Backend (Nueva Ruta en `api.routes.js`):**
    *   Crear un nuevo endpoint, por ejemplo: `GET /api/projects/:name/files`.
    *   Esta ruta usará el módulo `fs` de Node.js para escanear de forma recursiva el directorio del proyecto (`workspaces/[apiKey]/[projectName]`).
    *   Devolverá una estructura JSON que represente el árbol de archivos, por ejemplo: `[{ name: 'src', type: 'directory', children: [...] }, { name: 'package.json', type: 'file' }]`.

*   **Frontend (Nueva Lógica en `dashboard.js` y `ui.js`):**
    *   Cuando se seleccione un proyecto, se hará una llamada a este nuevo endpoint.
    *   Se usará el JSON recibido para renderizar el árbol en el DOM. Esto se puede hacer creando dinámicamente elementos `<ul>` y `<li>` anidados.
    *   Se añadirá un event listener a los elementos de archivo (`<li>` con `type: 'file'`) para que al hacer clic, se inserte la ruta en el `textarea`.

# archivios principales

{
  "name": "qwen-webui",
  "version": "1.0.0",
  "description": "**Un entorno de desarrollo web interactivo y auto-alojado, potenciado por el agente de codificación Qwen y modelos de lenguaje personalizables a través de LiteLLM.**",
  "main": "src/server.js",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "axios": "^1.11.0",
    "dotenv": "^17.2.1",
    "ejs": "^3.1.10",
    "express": "^4.19.2",
    "socket.io": "^4.8.1",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7"
  }
}

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar rutas y servicios
import appRoutes from './routes/app.routes.js';
import authRoutes from './routes/auth.routes.js';
import apiRoutes from './routes/api.routes.js';
import { initializeSocketManager } from './services/socketManager.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Montar rutas
app.use('/connect', authRoutes);
app.use('/api', apiRoutes);
app.use('/', appRoutes);

// Inicializar el gestor de sockets
initializeSocketManager(io);

// Manejador de errores global
app.use((err, req, res, next) => {
    console.error('DEBUG server.js: Error no manejado:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// Iniciar servidor
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

