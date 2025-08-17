# 🤖 Agente de Codificación Web (Qwen-Web-Agent)

**Un entorno de desarrollo web interactivo, similar a un IDE, potenciado por una arquitectura de Agente Dual y modelos de lenguaje personalizables a través de LiteLLM.**

Este proyecto ha evolucionado de un simple terminal de chat a un entorno de desarrollo integrado (IDE) en el navegador. Proporciona un explorador de archivos, un editor de código funcional y un asistente de IA con dos modos de operación distintos: un **Agente Arquitecto** para la planificación y un **Agente Programador** para la ejecución autónoma.

---

## 🏛️ Filosofía y Arquitectura Central

1.  **Aislamiento y Control:** La arquitectura está diseñada para un entorno multi-usuario y multi-proyecto. Cada proyecto vive en su propio directorio aislado, con su propia configuración (`.env`) y memoria (`QWEN.md`).

2.  **El Backend como Orquestador Inteligente:** El servidor Express.js actúa como el "cerebro", gestionando la UI (rutas, vistas, API) y orquestando la interacción entre los diferentes componentes: la base de datos, el editor de código y los agentes de IA.

3.  **Arquitectura de Agente Dual:** Hemos abandonado el modelo de "un solo disparo". La interacción con la IA se divide en dos modos distintos, controlados por el usuario a través de un switch en la interfaz:
    *   **Modo Arquitecto:** Utiliza una llamada directa al LLM (vía LiteLLM) para conversar, planificar y refinar estrategias. Su única capacidad de escritura es modificar el archivo `QWEN.md`, que sirve como el plan maestro del proyecto.
    *   **Modo Programador:** Invoca al agente de codificación `qwen` para que ejecute de forma autónoma (`--yolo`) las tareas definidas en el `QWEN.md`. Este agente interactúa directamente con el sistema de archivos para crear, modificar y leer código.

4.  **Backend como Intérprete:** El backend ya no retransmite ciegamente la salida del agente. Ahora analiza la salida del **Agente Programador**, busca patrones de acciones completadas (ej: `Tool write_file completed`), y genera un resumen limpio y conciso para el usuario y para el historial del chat.

5.  **El `QWEN.md` como Estado Central del Proyecto:** Este archivo ha evolucionado para convertirse en el "dashboard" y la fuente única de verdad para cada proyecto, documentando su objetivo, stack, estructura de archivos y el estado de las tareas.

---

## 📂 Los 3 Pilares del Flujo de Trabajo

| Pilar                    | Rol                                                                      | Quién lo Gestiona                                                            |
| :----------------------- | :----------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **1. Usuario Final**     | **El Director.** Supervisa, planifica y da la orden final de ejecución.    | El usuario, a través de la interfaz web.                                     |
| **2. Agente Arquitecto** | **El Planificador.** Conversa con el usuario para definir la estrategia.   | Nuestro Backend (llamada directa a LiteLLM). Su única salida es el `QWEN.md`. |
| **3. Agente Programador**| **El Ejecutor.** Lee el plan del `QWEN.md` y lo ejecuta en el código.      | Nuestro Backend (invocando al CLI `qwen` con `execa`).                       |

---

## 🛠️ Stack y Herramientas

*   **Backend:** Node.js, Express.js, Socket.IO, **`execa`**, **`directory-tree`**
*   **Frontend:** Vanilla JS, Bootstrap 5, EJS, **`jsTree`**, **`CodeMirror`**, Marked.js
*   **Base de Datos:** SQLite (`sqlite` y `sqlite3`)
*   **Agente de IA:** `qwen` CLI
*   **Proxy de Modelos:** `LiteLLM`

---

## 🎯 Estado Actual y Próximos Pasos

### ✅ Estado Actual

La aplicación ha sido completamente rediseñada en una **interfaz de IDE profesional de 3 columnas**, mejorando drásticamente la usabilidad y el control del usuario.

1.  **Layout de IDE Funcional:**
    *   Se implementó un layout de 3 columnas: **Navegador** (proyectos/archivos), **Editor** (código) y **Asistente** (chat).

2.  **Explorador de Archivos Interactivo (Sidebar Izquierdo):**
    *   Los proyectos se muestran en un **acordeón** expandible.
    *   Al expandir un proyecto, se carga y muestra un **árbol de archivos** (`jsTree`) con íconos específicos para cada tipo de archivo.
    *   El explorador permite visualizar el `QWEN.md`, pero oculta archivos sensibles como `.env`.

3.  **Editor de Código Funcional (Columna Central):**
    *   Se ha integrado el editor de código **`CodeMirror`**.
    *   Al hacer clic en un archivo del explorador, su contenido se carga en el editor con **resaltado de sintaxis** y números de línea.
    *   El usuario puede **editar y guardar** los archivos directamente en el disco a través de la interfaz.

4.  **Asistente de IA con Agente Dual (Sidebar Derecho):**
    *   El usuario puede cambiar entre **Modo Arquitecto** y **Modo Programador** con un switch.
    *   El **Modo Arquitecto** conversa de forma inteligente, usando el `QWEN.md` como contexto.
    *   El **Modo Programador** ejecuta las tareas y el backend genera un **resumen limpio de las acciones**, manteniendo el chat libre de logs técnicos.

5.  **Backend Robusto:**
    *   El uso de **`execa`** ha estabilizado la ejecución del agente en diferentes entornos.
    *   Los timeouts de conexión han sido resueltos a nivel de Nginx y LiteLLM.

### 🚀 Próximos Pasos

El núcleo de la aplicación está completo. Ahora nos enfocaremos en refinar la experiencia.

1.  **Actualización Dinámica de `QWEN.md`:**
    *   **Backend:** Implementar la lógica para que, después de una ejecución del Agente Programador, el `socketManager` actualice automáticamente las secciones "Tareas Completadas" y "Estructura de Archivos" en el archivo `QWEN.md`.

2.  **Refinar la UI del Chat:**
    *   **Frontend:** Aunque el backend envía un resumen limpio, la lógica de renderizado del historial (`loadAndRenderChatHistory`) aún necesita ser mejorada para formatear correctamente los resúmenes y los bloques de código guardados en la base de datos.

3.  **Editor con Pestañas Múltiples:**
    *   **Frontend:** Mejorar la columna del editor para que soporte la apertura de múltiples archivos en pestañas, similar a VS Code.

4.  **Implementar Funcionalidades Menores:**
    *   Activar el botón "Adjuntar Archivo".
    *   Implementar una lógica para que los comandos nativos de qwen (ej: `/memory`, `!npm install`) se pasen directamente al Agente Programador.

Listo para continuar mañana.

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

