Actua como un agente experto en:

- expressjs
- socket IO
- liteLLM
- qwen coder

Respondes en español de manera corta y precisa

---

# 🤖 Agente de Codificación Web (Proyecto: Qwen-Web-Agent)

**Un entorno de desarrollo web interactivo y auto-alojado, potenciado por el agente de codificación `qwen` y modelos de lenguaje personalizables a través de LiteLLM.**

Este proyecto lleva la experiencia de un agente de codificación autónomo, capaz de interactuar con un sistema de archivos, a una interfaz web limpia y en tiempo real. Permite la configuración detallada de modelos de IA, la creación de proyectos aislados y una interacción fluida para el desarrollo de código asistido por IA.

---

## 🏛️ Filosofía y Arquitectura Central

1.  **Aislamiento y Control:** La arquitectura está diseñada para un entorno multi-usuario y multi-proyecto. Cada proyecto vive en su propio directorio aislado, con su propia configuración (`.env`, `settings.json`) y contexto (`QWEN.md`), garantizando que no haya contaminación de datos entre proyectos.

2.  **El Backend como Orquestador Inteligente:** El servidor Express.js no es un simple intermediario. Actúa como el "cerebro" de la aplicación, gestionando el estado persistente (en SQLite) y preparando el entorno de ejecución temporal para el agente `qwen` en cada interacción.

3.  **El Agente `qwen` como Herramienta Efímera:** Tratamos al CLI de `qwen` como una herramienta potente pero sin estado ("single-shot"). Se invoca para una tarea específica (responder un prompt), se le proporciona todo el contexto que necesita en ese momento y luego se descarta. Esto asegura un sistema predecible y sin fugas de memoria.

4.  **Experiencia en Tiempo Real:** La interactividad es clave. La comunicación con el agente se realiza mediante streaming a través de Socket.IO, mostrando las respuestas palabra por palabra para una experiencia de usuario fluida y moderna.

5.  **Desarrollo Orientado al Contexto:** Los proyectos se crean con una configuración base (stack, descripción) que se usa para generar un archivo `QWEN.md` inicial. Esto asegura que el agente siempre tenga el "propósito" del proyecto como punto de partida.

---

## 📂 Estructura Detallada del Proyecto

```
/qwen-web-agent/
│
├── 📁 workspaces/
│   └── 📁 [apiKey]/                # Directorio del usuario, identificado por su API Key.
│       └── 📁 [projectName]/       # Directorio aislado para cada proyecto.
│           ├── .env                # Configuración de API para este proyecto (leído por qwen).
│           ├── settings.json       # Configuración específica del proyecto (leído por qwen).
│           └── QWEN.md             # Contexto y memoria del chat (escrito por nuestro backend).
│
├── 📁 src/
│   │
│   ├── 📁 public/                 # Archivos estáticos del cliente.
│   │   ├── 📁 css/style.css
│   │   └── 📁 js/main.js          # Lógica del cliente: Socket.IO, DOM, API calls, streaming.
│   │
│   ├── 📁 views/                  # Plantillas EJS.
│   │   ├── 📁 partials/...
│   │   ├── login.ejs
│   │   └── dashboard.ejs
│   │
│   ├── 📁 routes/                 # Definición de rutas de la API y vistas.
│   │   ├── auth.routes.js
│   │   ├── app.routes.js
│   │   └── api.routes.js
│   │
│   ├── 📁 services/
│   │   ├── socketManager.js    # Lógica central: Orquesta la interacción entre SQLite y qwen.
│   │   └── workspaceManager.js # Utilidades para crear la estructura de archivos del proyecto.
│   │
│   ├── 📁 db/
│   │   ├── database.js         # Configuración e inicialización de SQLite.
│   │   └── qwen-data.db        # Archivo de la base de datos SQLite.
│   │
│   └── server.js               # Punto de entrada de la aplicación.
│
├── .env.example                  # Ejemplo de variables de entorno para el servidor Node.js.
├── package.json
└── README.md
```

---

## 🛠️ Stack y Herramientas

*   **Backend:** Node.js (v20+, `"type": "module"`), Express.js, EJS, Socket.IO
*   **Frontend:** Vanilla JS, Bootstrap 5 (CDN)
*   **Base de Datos:** SQLite (`sqlite3`) - **La fuente de la verdad para el historial de chat.**
*   **Agente de IA:** `qwen` CLI - **La herramienta de ejecución para procesar prompts.**
*   **Proxy de Modelos:** `LiteLLM` (auto-alojado por el usuario)
*   **Utilidades:** `dotenv` (para el servidor), `axios`

---

## ✅ Flujo de Trabajo Detallado (Lo que tenemos que hacer)

Este es el plan de implementación, reflejando nuestra arquitectura final.

### 1. Configuración Inicial y Base de Datos
*   **Entorno:** Instalar dependencias (`npm install`). Crear un archivo `.env` en la raíz para la configuración del servidor (ej: `PORT=3000`).
*   **Base de Datos (`database.js`):** Crear una tabla `chats` con columnas: `id`, `project_id`, `api_key`, `role` (user/assistant), `content`, `timestamp`.

### 2. Creación de Proyectos (`workspaceManager.js` y `api.routes.js`)
*   La API `POST /api/projects` recibirá los datos del nuevo proyecto.
*   Llamará a una función en `workspaceManager.js` que:
    1.  Crea la estructura de directorios: `/workspaces/[apiKey]/[projectName]/`.
    2.  Crea los archivos iniciales **dentro** de esa carpeta:
        *   `.env`: Con la `OPENAI_API_KEY`, `OPENAI_BASE_URL` y `OPENAI_MODEL` que el usuario haya configurado.
        *   `settings.json`: Un JSON de configuración por defecto para `qwen`.
        *   `QWEN.md`: Un archivo inicial con el "propósito" del proyecto, generado a partir del stack y la descripción proporcionados por el usuario.

### 3. El Corazón de la Interacción (`socketManager.js`)

Este es el flujo para cada mensaje de usuario:

1.  **Recibir Mensaje:** El manejador `on('userMessage', ...)` se activa.
2.  **Guardar en DB:** El mensaje del usuario se guarda inmediatamente en la tabla `chats` de SQLite.
3.  **Construir Contexto:**
    *   Se realiza una consulta a SQLite para obtener el historial reciente de la conversación para ese proyecto.
    *   Este historial se formatea y se **escribe (o sobrescribe) en el archivo `QWEN.md`** del directorio del proyecto.
4.  **Invocar al Agente:**
    *   Se utiliza `child_process.spawn` para ejecutar `qwen`.
    *   **Argumentos:** Se usa un array de argumentos vacío (`[]`) o con `--yolo` para permitir la escritura de archivos. **No se pasan credenciales**, ya que `qwen` las leerá de su propio `.env`.
    *   **Opción Clave:** `cwd: projectPath` se establece en el directorio del proyecto actual para garantizar un aislamiento total.
5.  **Streaming de la Respuesta:**
    *   Se escucha el evento `stdout.on('data', ...)` del proceso.
    *   Cada "chunk" de datos recibido se envía **inmediatamente** al frontend a través de un evento de socket (ej: `agentMessage`, `type: 'stdout_chunk'`).
6.  **Finalizar y Guardar:**
    *   Se escucha el evento `on('close', ...)` del proceso.
    *   La respuesta completa (reconstruida a partir de los chunks) se guarda en la tabla `chats` de SQLite.
    *   Se envía un evento de finalización (`type: 'stream_end'`) al frontend.

### 4. Lógica del Cliente (`main.js`)
*   **Enviar Mensajes:** El input del usuario se envía al backend a través de `socket.emit('userMessage', ...)`.
*   **Recibir Stream:** El cliente escucha el evento `agentMessage`.
    *   Si `type === 'stdout_chunk'`, añade el texto al final del último mensaje en la UI, creando el efecto de "escritura en tiempo real".
    *   Si `type === 'stream_end'`, indica que la respuesta ha finalizado (ej: ocultando un cursor parpadeante).
*   **Cargar Historial:** Al seleccionar un proyecto, una llamada a la API (`GET /api/projects/:id/chat`) obtiene el historial desde SQLite y lo renderiza en la terminal.

---

## 🔒 Aislamiento y Seguridad

*   **La API Key como Namespace:** La `apiKey` actúa como un identificador único para el `workspace`, aislando los datos de cada usuario.
*   **El `cwd` como Sandbox:** La opción `cwd` en `spawn` es la garantía de que cada ejecución de `qwen` está "enjaulada" dentro del directorio de su proyecto, sin acceso ni conocimiento de otros proyectos o archivos globales.

---

## 🎯 Objetivos y Resultado Final

El objetivo es crear una aplicación web robusta que:
1.  **Se autentica** con una API Key de LiteLLM.
2.  Permite **configurar y crear proyectos** con un contexto y configuración de IA propios.
3.  **Interactúa en tiempo real** con el agente `qwen`, mostrando las respuestas mediante streaming.
4.  **Gestiona el historial de chat de forma persistente y segura** en una base de datos, mientras utiliza archivos temporales para dar contexto al agente.
5.  **(A futuro)** Permite ejecutar comandos de utilidad como `/stats` delegando la tarea al agente y mostrando el resultado en la UI.

El resultado será un IDE web contextual, seguro y con una experiencia de usuario fluida, que separa claramente las responsabilidades entre la gestión de la aplicación (Express/SQLite) y la ejecución de tareas de IA (qwen).