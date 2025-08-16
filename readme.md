
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

| Componente                 | Rol                                       | Quién lo Gestiona                                      |
| :------------------------- | :---------------------------------------- | :----------------------------------------------------- |
| **Base de Datos SQLite**   | **Memoria de la Interfaz de Usuario (UI)** | **Nuestro Backend.** Guarda el historial del chat.   |
| **`stdin` del `qwen`**     | **Contexto de la Conversación Actual**     | **Nuestro Backend.** Pasa el historial reciente al agente. |
| **Archivo `QWEN.md`**      | **Manual de Instrucciones del Agente**     | **Nosotros (al inicio) y luego el Agente `qwen`.**    |

---

## 🛠️ Stack y Herramientas

*   **Backend:** Node.js, Express.js, Socket.IO
*   **Frontend:** Vanilla JS, Bootstrap 5, EJS, Marked.js, Highlight.js
*   **Base de Datos:** SQLite (`sqlite` y `sqlite3`)
*   **Agente de IA:** `qwen` CLI
*   **Proxy de Modelos:** `LiteLLM`

---

## 🎯 Estado Actual y Próximos Pasos

### ✅ Estado Actual

La aplicación ha experimentado una **mejora masiva en la experiencia de usuario (UX) y la robustez de la interfaz**. Se han completado las siguientes tareas clave:

1.  **Layout Profesional de la UI:**
    *   Se implementó un layout de tres columnas (sidebar, chat, info) que ocupa el 100% de la altura de la ventana.
    *   Tanto el historial del chat como la columna de información ahora tienen **scrolls independientes**, emulando el comportamiento de aplicaciones como VS Code o WhatsApp Web. El layout ya no se deforma al cargar contenido dinámico.

2.  **Renderizado Inteligente de Respuestas:**
    *   La UI ahora **detecta y formatea automáticamente el código** en las respuestas del agente, incluso si no viene en formato Markdown. El código HTML, JSON, etc., se muestra en bloques con resaltado de sintaxis.
    *   Los **logs técnicos** del agente (ej: `Tool write_file completed...`) se limpian y transforman en notificaciones de sistema legibles para el usuario, manteniendo el chat limpio y ordenado.

3.  **Manejo de Errores y Paneles de Información:**
    *   Los errores de la API del LLM ahora se capturan correctamente en el backend y se muestran al usuario en un modal (`sweetalert2`), en lugar de romper el chat.
    *   Se ha añadido un panel de **"Información del Usuario"** que consulta la API de LiteLLM para mostrar datos como el alias, el gasto y el presupuesto de la API Key.
    *   La UI del chat se ha limpiado, moviendo el log del sistema a su propio panel en la columna de información.

### 🚀 Próximos Pasos 

Nuestra prioridad es integrar un **Explorador de Archivos** interactivo en el sidebar.

**PRIORIDAD 1: Explorador de Archivos (Estilo VS Code)**

El objetivo es permitir al usuario visualizar y examinar los archivos del proyecto directamente desde la interfaz. La implementación se dividirá en dos fases:

1.  **Fase 1: Visualización del Árbol de Archivos**
    *   **Backend:** Crear un nuevo endpoint (`GET /api/projects/:name/files`) que leerá recursivamente el directorio del proyecto (excluyendo `.env`, `QWEN.md`, etc.) y devolverá una estructura de árbol en formato JSON.
    *   **Frontend:**
        *   Añadir un nuevo contenedor en el sidebar para el explorador de archivos.
        *   Cuando se seleccione un proyecto, llamar al nuevo endpoint.
        *   Con el JSON recibido, renderizar dinámicamente el árbol de archivos y directorios (`<ul>` y `<li>` anidados) con íconos apropiados.

2.  **Fase 2: Visualización del Contenido de Archivos en un Modal**
    *   **Backend:** Crear un segundo endpoint (`POST /api/projects/:name/file-content`) que, dada una ruta de archivo, leerá y devolverá su contenido como texto plano.
    *   **Frontend:**
        *   Añadir el HTML de un modal a `dashboard.ejs`.
        *   Añadir un event listener a los elementos de archivo en el árbol.
        *   Al hacer clic, llamar al endpoint de contenido, y mostrar la respuesta en el modal con resaltado de sintaxis (`highlight.js`).

**Otras Tareas Pendientes:**
*   Implementar la funcionalidad del botón "Adjuntar Archivo".
*   Implementar la lógica para pasar comandos `/` directamente al agente.

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
└── readme.md
```

---

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

