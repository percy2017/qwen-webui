let currentProject = null;
let socket = null;
let codeEditor = null;
let currentOpenFile = null;

const elements = {};

document.addEventListener("DOMContentLoaded", initializeDashboard);

function initializeDashboard() {
  console.log("Dashboard inicializado con Acordeón.");

  elements.saveFileBtn = document.getElementById("save-file-btn");
  elements.projectsAccordion = document.getElementById("projects-accordion");
  elements.userAlias = document.getElementById("user-alias");
  elements.logoutBtn = document.getElementById("logout-btn");
  elements.newProjectBtn = document.getElementById("new-project-btn");

  elements.chatHistory = document.getElementById("chat-history");
  elements.chatForm = document.getElementById("chat-form");
  elements.userInput = document.getElementById("user-input");
  elements.sendBtn = document.getElementById("send-btn");
  elements.attachFileBtn = document.getElementById("attach-file-btn");
  elements.agentModeSwitch = document.getElementById("agent-mode-switch");
  elements.agentModeLabel = document.getElementById("agent-mode-label");
  elements.activeLlmIndicator = document.getElementById("active-llm-indicator");
  elements.saveFileBtn = document.getElementById("save-file-btn");

  elements.userDropdownName = document.getElementById("user-dropdown-name");
  elements.userDropdownAlias = document.getElementById("user-dropdown-alias");
  elements.userDropdownSpend = document.getElementById("user-dropdown-spend");
  elements.userDropdownBudget = document.getElementById("user-dropdown-budget");

  elements.newProjectModal = new bootstrap.Modal(
    document.getElementById("newProjectModal")
  );
  elements.newProjectForm = document.getElementById("newProjectForm");

  elements.settingsBtn = document.getElementById("settings-btn");
  elements.settingsModal = new bootstrap.Modal(
    document.getElementById("settingsModal")
  );
  elements.modelSelect = document.getElementById("modelSelect");
  elements.themeSelect = document.getElementById("themeSelect");
  elements.currentProjectModelSelect = document.getElementById(
    "currentProjectModel"
  );
  elements.settingsForProjectName = document.getElementById(
    "settingsForProjectName"
  );
  elements.currentProjectSettingsDiv = document.getElementById(
    "currentProjectSettings"
  );
  elements.saveSettingsBtn = document.getElementById("saveSettingsBtn");
  loadAndRenderProjects();
  loadAndRenderUserInfo();
  initSockets();
  setupEventListeners();
}

async function loadAndRenderProjects() {
  elements.projectsAccordion.innerHTML =
    '<div class="text-muted p-3">Cargando...</div>';

  try {
    const apiKey = localStorage.getItem("qwen_api_key");
    if (!apiKey) throw new Error("API Key no encontrada.");

    const response = await fetch("/api/projects", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok)
      throw new Error("No se pudo cargar la lista de proyectos.");

    const { projects } = await response.json();

    elements.projectsAccordion.innerHTML = "";
    if (projects && projects.length > 0) {
      projects.forEach((project) => renderProjectAccordionItem(project));
    } else {
      elements.projectsAccordion.innerHTML =
        '<div class="text-muted p-3">No hay proyectos.</div>';
    }
  } catch (error) {
    console.error("Error al cargar proyectos:", error);
    elements.projectsAccordion.innerHTML = `<div class="text-danger p-3">${error.message}</div>`;
  }
}

function renderProjectAccordionItem(project) {
  const projectSlug = project.name.replace(/\s+/g, "-").toLowerCase(); // ID único para el HTML

  const accordionItem = document.createElement("div");
  accordionItem.className = "accordion-item";
  accordionItem.innerHTML = `
        <h2 class="accordion-header" id="heading-${projectSlug}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${projectSlug}" aria-expanded="false" aria-controls="collapse-${projectSlug}">
                ${project.name}
            </button>
        </h2>
        <div id="collapse-${projectSlug}" class="accordion-collapse collapse" aria-labelledby="heading-${projectSlug}" data-bs-parent="#projects-accordion">
            <div class="accordion-body">
                <div id="file-explorer-${projectSlug}" class="file-explorer-instance">
                    <div class="text-muted small p-2">Cargando archivos...</div>
                </div>
            </div>
        </div>
    `;

  elements.projectsAccordion.appendChild(accordionItem);
  const collapseElement = accordionItem.querySelector(
    `#collapse-${projectSlug}`
  );
  collapseElement.addEventListener("show.bs.collapse", () => {
    selectProject(project.name, `file-explorer-${projectSlug}`);
  });
}

async function selectProject(projectName, containerId) {
  currentProject = projectName;
  console.log(`Proyecto seleccionado: ${projectName}`);

  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const apiKey = localStorage.getItem("qwen_api_key");
    if (!apiKey) throw new Error("API Key no encontrada.");

    const response = await fetch(`/api/projects/${projectName}/files`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok)
      throw new Error("No se pudo cargar la estructura de archivos.");

    const fileTreeData = await response.json();
    initializeFileExplorer(fileTreeData, container);
    loadProjectInfo(projectName);
    loadAndRenderChatHistory(projectName);
  } catch (error) {
    console.error(`Error al cargar archivos para ${projectName}:`, error);
    container.innerHTML = `<div class="text-danger small p-2">${error.message}</div>`;
  }
}

function initializeFileExplorer(treeData, container) {
  const jstreeFormat = transformToJsTreeFormat(treeData);
  const $container = $(container);
  if ($container.jstree(true)) {
    $container.jstree("destroy");
  }
  $container.empty();
  $container
    .jstree({
      core: {
        data: jstreeFormat,
        themes: { name: "default-dark", responsive: true },
      },
      plugins: ["wholerow", "types"],
      types: {
        default: { icon: "bi bi-file-earmark" },
        folder: { icon: "jstree-folder" },
        html: { icon: "bi bi-filetype-html" },
        css: { icon: "bi bi-filetype-css" },
        js: { icon: "bi bi-filetype-js" },
        json: { icon: "bi bi-filetype-json" },
        md: { icon: "bi bi-filetype-md" }
      },
    })
    .on("select_node.jstree", function (e, data) {
      const node = data.node;
      if (data.instance.is_leaf(node)) {
        const filePath = node.li_attr["data-path"];
        loadFileContent(filePath);
      }
    });
}

async function loadFileContent(filePath) {
  const welcomeMessage = document.getElementById("welcome-message");
  const editorWrapper = document.getElementById("code-editor-wrapper");
  const saveBtn = document.getElementById("save-file-btn");
  if (codeEditor) {
    codeEditor.setValue("Cargando contenido...");
  }
  welcomeMessage.classList.add("d-none");
  editorWrapper.classList.remove("d-none");
  saveBtn.classList.remove("d-none");
  currentOpenFile = filePath;

  try {
    const apiKey = localStorage.getItem("qwen_api_key");
    if (!apiKey) throw new Error("API Key no encontrada.");
    const response = await fetch(
      `/api/projects/${currentProject}/file-content`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ filePath: filePath }),
      }
    );
    if (!response.ok)
      throw new Error(
        `Error ${response.status}: No se pudo cargar el archivo.`
      );
    const fileContent = await response.text();
    initializeCodeEditor(fileContent, filePath);
  } catch (error) {
    console.error("Error al cargar el contenido del archivo:", error);
    initializeCodeEditor(
      `Error al cargar ${filePath}:\n\n${error.message}`,
      "plaintext"
    );
  }
}

function transformToJsTreeFormat(node) {
    if (!node) return Array.isArray(node) ? [] : null;

    if (Array.isArray(node)) {
        return node.map(child => transformToJsTreeFormat(child));
    }

    let nodeType = 'default';
    if (node.type === 'directory') {
        nodeType = 'folder';
    } else {
        const extension = node.name.split('.').pop().toLowerCase();
        switch (extension) {
            case 'js': nodeType = 'js'; break;
            case 'html': case 'ejs': nodeType = 'html'; break;
            case 'css': nodeType = 'css'; break;
            case 'json': nodeType = 'json'; break;
            case 'md': nodeType = 'md'; break;
        }
    }

    const jstreeNode = {
        text: node.name,
        type: nodeType, // <-- Asignamos el tipo aquí en lugar del ícono
        children: (node.children || []).map(child => transformToJsTreeFormat(child)),
        li_attr: { 'data-path': node.path },
    };

    if (node.type === 'file') {
        delete jstreeNode.children;
    }

    return jstreeNode;
}

function initializeCodeEditor(content, filePath) {
  const editorWrapper = document.getElementById("code-editor-wrapper");
  const languageMode = getLanguageFromPath(filePath);

  if (!codeEditor) {
    codeEditor = CodeMirror(editorWrapper, {
      value: content,
      mode: languageMode,
      theme: "tokyo-night",
      lineNumbers: true,
      lineWrapping: true,
      autofocus: true,
    });
  } else {
    codeEditor.setValue(content);
    codeEditor.setOption("mode", languageMode);
  }
  setTimeout(() => codeEditor.refresh(), 1);
}

function getLanguageFromPath(filePath) {
  const extension = filePath.split(".").pop().toLowerCase();
  switch (extension) {
    case "js":
      return "javascript";
    case "json":
      return { name: "javascript", json: true };
    case "css":
      return "css";
    case "html":
    case "ejs":
      return "htmlmixed";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

async function handleSaveFile() {
  if (!currentProject || !currentOpenFile || !codeEditor) {
    Swal.fire("Error", "No hay ningún archivo abierto para guardar.", "error");
    return;
  }

  const saveBtn = document.getElementById("save-file-btn");
  const originalBtnContent = saveBtn.innerHTML;

  // Deshabilitar botón y mostrar estado de carga
  saveBtn.disabled = true;
  saveBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Guardando...
    `;

  try {
    const apiKey = localStorage.getItem("qwen_api_key");
    if (!apiKey) throw new Error("API Key no encontrada.");

    const fileContent = codeEditor.getValue(); // Obtener el contenido actual del editor

    const response = await fetch(`/api/projects/${currentProject}/save-file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        filePath: currentOpenFile,
        content: fileContent,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Error desconocido del servidor.");
    }

    // Mostrar notificación de éxito
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Archivo guardado",
      showConfirmButton: false,
      timer: 2000,
    });
  } catch (error) {
    console.error("Error al guardar el archivo:", error);
    Swal.fire("Error al Guardar", error.message, "error");
  } finally {
    // Restaurar el botón a su estado original
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalBtnContent;
  }
}


let assistantMessageElement = null;
let fullAssistantResponse = "";
function initSockets() {
  const apiKey = localStorage.getItem("qwen_api_key");
  if (!apiKey) {
    Swal.fire("Error de Autenticación", "No se encontró la API Key.", "error");
    return;
  }

  socket = io({ auth: { apiKey } });

  socket.on("connect", () => console.log("Conectado al servidor de sockets."));
  socket.on("disconnect", () =>
    console.log("Desconectado del servidor de sockets.")
  );

  socket.on("agentMessage", (data) => {
    const { type, data: chunk } = data;

    if (type === "start") {
      fullAssistantResponse = ""; // <--- 2. Resetear el acumulador
      const loadingElement = document.querySelector(
        ".assistant-message:last-child"
      );
      if (loadingElement && loadingElement.querySelector(".spinner-border")) {
        assistantMessageElement = loadingElement;
        assistantMessageElement.innerHTML = "";
      } else {
        assistantMessageElement = addChatMessage("assistant", "");
      }
    } else if (type === "chunk") {
      if (assistantMessageElement) {
        // --- 3. LÓGICA DE RENDERIZADO CON MARKED ---
        fullAssistantResponse += chunk; // Acumular el nuevo trozo
        assistantMessageElement.innerHTML = marked.parse(fullAssistantResponse); // Procesar y renderizar como HTML
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
      }
    } else if (type === "end") {
      console.log("Transmisión finalizada.");
      setUiLockState(false);
      assistantMessageElement = null; // Liberar la referencia
    }
  });

  socket.on("agentError", (error) => {
    Swal.fire("Error del Agente", error.message, "error");
    const loadingElement = document.querySelector(
      ".assistant-message:last-child"
    );
    if (loadingElement && loadingElement.querySelector(".spinner-border")) {
      loadingElement.remove();
    }
    setUiLockState(false);
    assistantMessageElement = null;
  });

  socket.on("refreshExplorer", () => {
    console.log("Recibida orden para refrescar el explorador de archivos.");
    // Volvemos a cargar toda la estructura de proyectos.
    // Esto colapsará los acordeones, pero asegurará que los datos estén 100% actualizados.
    loadAndRenderProjects();
  });
}

function setupEventListeners() {
  elements.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  elements.agentModeSwitch.addEventListener("change", (e) => {
    const isProgrammerMode = e.target.checked;
    if (isProgrammerMode) {
      elements.agentModeLabel.textContent = "Modo Programador";
    } else {
      elements.agentModeLabel.textContent = "Modo Arquitecto";
    }
  });
  elements.saveFileBtn.addEventListener("click", handleSaveFile);
  elements.userInput.addEventListener("input", () => {
    elements.userInput.style.height = "auto";
    elements.userInput.style.height = `${elements.userInput.scrollHeight}px`;
  });

  elements.userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  elements.newProjectBtn.addEventListener("click", () => {
    elements.newProjectModal.show();
  });

  elements.newProjectForm.addEventListener("submit", handleCreateProject);
  elements.settingsBtn.addEventListener("click", handleOpenSettings);
  elements.saveSettingsBtn.addEventListener("click", handleSaveSettings);
}

function handleSendMessage() {
  const message = elements.userInput.value.trim();
  if (!message || !socket || !socket.connected || !currentProject) {
    return;
  }

  const isProgrammerMode = elements.agentModeSwitch.checked;
  const agentMode = isProgrammerMode ? "Programmer" : "Architect";
  console.log(`Enviando mensaje en modo: ${agentMode}`);
  addChatMessage("user", message);
  socket.emit("userMessage", {
    projectName: currentProject,
    message: message,
    agentMode: agentMode,
  });
  elements.userInput.value = "";
  elements.userInput.style.height = "auto";
  setUiLockState(true);
  addChatMessage("assistant", "loading");
}

function setUiLockState(isLocked) {
  elements.userInput.disabled = isLocked;
  elements.sendBtn.disabled = isLocked;
  elements.attachFileBtn.disabled = isLocked;
  elements.agentModeSwitch.disabled = isLocked;
}

function addChatMessage(role, content) {
  const messageElement = document.createElement("div");
  messageElement.className = `message ${role}-message`;

  if (role === "user") {
    messageElement.textContent = content;
  } else if (content === "loading") {
    messageElement.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="spinner-border spinner-border-sm me-2"></span>
                <strong>Pensando...</strong>
            </div>
        `;
  } else {
    // Para mensajes del asistente, usamos innerHTML y procesamos con marked
    // La limpieza de logs se hará antes de llamar a esta función.
    messageElement.innerHTML = marked.parse(content);
  }

  elements.chatHistory.appendChild(messageElement);
  elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
  return messageElement;
}

function renderComplexAssistantMessage(rawContent) {
  const writeFileRegex =
    /([\s\S]*?)\[.*?\] 🔧 Executing tool: write_file \(content: "([\s\S]*?)", file_path: ".*?[\\\/]([\w.-]+)"\)[\s\S]*?✅ Tool write_file completed successfully[\s\S]*?(?:Listo!|I'm done!|Hecho!)([\s\S]*)/s;

  const match = rawContent.match(writeFileRegex);

  if (match) {
    const textBefore = match[1].trim();
    const codeContent = match[2]; // No trimear el código para mantener la indentación
    const fileName = match[3].trim();
    const textAfter = match[4].trim();

    // Determinar el lenguaje para highlight.js
    const language = fileName.split(".").pop().toLowerCase();

    // Construir el nuevo contenido en formato Markdown
    return `
${textBefore}

✅ **Acción del sistema:** Se guardó el archivo \`${fileName}\`.

\`\`\`${language}
${codeContent}
\`\`\`

${textAfter}
        `.trim();
  }

  // Si no es un 'write_file', simplemente limpiamos otros logs genéricos
  // Esto oculta logs de read_file, list_directory, etc.
  let cleanContent = rawContent.replace(
    /\[.*?\] 🔧 Executing tool: [\s\S]*?✅ Tool.*?completed successfully/g,
    ""
  );

  // Limpiar el "pensamiento" del agente
  cleanContent = cleanContent.replace(
    /analysisUser says[\s\S]*?assistantfinal;/,
    ""
  );

  return cleanContent.trim();
}

async function loadAndRenderUserInfo() {
  async function fetchUserInfo() {
    const apiKey = localStorage.getItem("qwen_api_key");
    const litellmUrl = localStorage.getItem("qwen_litellm_url");

    if (!apiKey || !litellmUrl) {
      throw new Error("API Key o LiteLLM URL no encontradas en localStorage.");
    }

    const response = await fetch(
      `/api/user/info?litellmUrl=${encodeURIComponent(litellmUrl)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!response.ok) {
      throw new Error("No se pudo cargar la información del usuario");
    }

    const result = await response.json();
    console.log(result);
    return result.success ? result.data : null;
  }

  try {
    const userInfoData = await fetchUserInfo();
    const userInfo = userInfoData ? userInfoData.info : null;

    if (userInfo) {
      elements.userAlias.textContent = userInfo.key_alias || "Usuario";
      elements.userDropdownName.textContent =
        userInfo.key_alias || "Usuario Anónimo";
      elements.userDropdownAlias.textContent = userInfo.key_alias || "";
      elements.userDropdownSpend.textContent = userInfo.spend
        ? `$${parseFloat(userInfo.spend).toFixed(4)}`
        : "$0.00";
      elements.userDropdownBudget.textContent = userInfo.max_budget
        ? `$${parseFloat(userInfo.max_budget).toFixed(2)}`
        : "Sin límite";
    } else {
      throw new Error(
        "La respuesta de la API no contiene información del usuario."
      );
    }
  } catch (error) {
    console.error("Error al cargar info del usuario:", error);
    elements.userAlias.textContent = "Error";
    elements.userDropdownName.textContent = "Error al cargar";
  }
}

async function handleCreateProject(e) {
  e.preventDefault(); // Evitar que la página se recargue

  // Obtener los valores de los inputs del formulario
  const name = document.getElementById("projectName").value.trim();
  const stack = document.getElementById("projectStack").value.trim();
  const description = document
    .getElementById("projectDescription")
    .value.trim();

  // Obtener datos necesarios de localStorage
  const apiKey = localStorage.getItem("qwen_api_key");
  const litellmUrl = localStorage.getItem("qwen_litellm_url");
  // Podríamos añadir un selector de modelo en el modal en el futuro
  const model = "default-model"; // Usamos un placeholder por ahora

  if (!name || !stack || !description) {
    Swal.fire(
      "Campos Incompletos",
      "Por favor, completa todos los campos para crear el proyecto.",
      "warning"
    );
    return;
  }

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ name, stack, description, litellmUrl, model }),
    });

    const result = await response.json();
    if (!response.ok) {
      // Si el servidor devuelve un error, lo mostramos
      throw new Error(
        result.message || "Error desconocido al crear el proyecto."
      );
    }

    // Si todo va bien...
    elements.newProjectModal.hide(); // Ocultar el modal
    e.target.reset(); // Limpiar el formulario

    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "¡Proyecto creado!",
      showConfirmButton: false,
      timer: 2000,
    });

    loadAndRenderProjects(); // Recargar la lista de proyectos para mostrar el nuevo
  } catch (error) {
    console.error("Error al crear el proyecto:", error);
    Swal.fire("Error", error.message, "error");
  }
}

async function handleOpenSettings() {
  const defaultModel = localStorage.getItem("qwen_default_model") || "";
  elements.themeSelect.value = localStorage.getItem("theme") || "dark";

  // Poblar la lista de modelos por defecto
  await populateModelSelect(elements.modelSelect, defaultModel);

  // Si hay un proyecto activo, mostrar y poblar sus ajustes específicos
  if (currentProject) {
    elements.settingsForProjectName.textContent = currentProject;
    elements.currentProjectSettingsDiv.style.display = "block";
    elements.currentProjectModelSelect.disabled = false;

    try {
      const apiKey = localStorage.getItem("qwen_api_key");
      const response = await fetch(`/api/projects/${currentProject}/info`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const result = await response.json();
      const currentModel = result.success ? result.envConfig.OPENAI_MODEL : "";
      await populateModelSelect(
        elements.currentProjectModelSelect,
        currentModel
      );
    } catch (error) {
      console.error("Error al cargar la config del proyecto:", error);
    }
  } else {
    elements.currentProjectSettingsDiv.style.display = "none";
    elements.currentProjectModelSelect.disabled = true;
  }

  elements.settingsModal.show();
}

async function handleSaveSettings() {
  // Guardar ajustes generales
  localStorage.setItem("qwen_default_model", elements.modelSelect.value);
  localStorage.setItem("theme", elements.themeSelect.value);
  document.documentElement.setAttribute(
    "data-bs-theme",
    elements.themeSelect.value
  );

  // Guardar ajustes específicos del proyecto si aplica
  if (currentProject && !elements.currentProjectModelSelect.disabled) {
    try {
      const apiKey = localStorage.getItem("qwen_api_key");
      const litellmUrl = localStorage.getItem("qwen_litellm_url");
      const response = await fetch(`/api/projects/${currentProject}/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          litellmUrl: litellmUrl,
          selectedModel: elements.currentProjectModelSelect.value,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      // Actualizar la UI del chat si el modelo cambió
      document.querySelector("#active-llm-indicator span").textContent =
        elements.currentProjectModelSelect.value;
    } catch (error) {
      Swal.fire(
        "Error",
        `No se pudo guardar la configuración del proyecto: ${error.message}`,
        "error"
      );
    }
  }

  elements.settingsModal.hide();
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: "Ajustes guardados",
    showConfirmButton: false,
    timer: 2000,
  });
}

async function populateModelSelect(selectElement, selectedValue = null) {
  const litellmUrl = localStorage.getItem("qwen_litellm_url");
  const apiKey = localStorage.getItem("qwen_api_key");
  selectElement.innerHTML = "<option>Cargando...</option>";

  try {
    const response = await fetch(
      `/api/models?litellmUrl=${encodeURIComponent(
        litellmUrl
      )}&apiKey=${encodeURIComponent(apiKey)}`
    );
    const result = await response.json();

    if (!result.success || !result.models)
      throw new Error("No se pudieron obtener los modelos.");

    selectElement.innerHTML =
      '<option value="">-- Modelo por defecto --</option>';
    result.models.forEach((model) => {
      const option = new Option(model.id, model.id);
      if (model.id === selectedValue) {
        option.selected = true;
      }
      selectElement.add(option);
    });
  } catch (error) {
    console.error("Error al cargar modelos:", error);
    selectElement.innerHTML = "<option>Error al cargar</option>";
  }
}

async function loadProjectInfo(projectName) {
  const llmIndicatorSpan = elements.activeLlmIndicator.querySelector("span");
  llmIndicatorSpan.textContent = "Actualizando...";

  try {
    const apiKey = localStorage.getItem("qwen_api_key");
    if (!apiKey) throw new Error("API Key no encontrada.");

    const response = await fetch(`/api/projects/${projectName}/info`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok)
      throw new Error("No se pudo obtener la info del proyecto.");

    const result = await response.json();
    const model = result.success
      ? result.envConfig.OPENAI_MODEL
      : "No definido";

    llmIndicatorSpan.textContent = model;
  } catch (error) {
    console.error(`Error al cargar info para ${projectName}:`, error);
    llmIndicatorSpan.textContent = "Error";
  }
}

async function loadAndRenderChatHistory(projectName) {
  elements.chatHistory.innerHTML =
    '<div class="text-center text-muted small p-3">Cargando historial...</div>';

  try {
    const apiKey = localStorage.getItem("qwen_api_key");
    if (!apiKey) throw new Error("API Key no encontrada.");

    const response = await fetch(`/api/projects/${projectName}/chat`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error("No se pudo cargar el historial.");

    const result = await response.json();
    const history = result.success ? result.history : [];

    elements.chatHistory.innerHTML = "";
    if (history.length === 0) {
      elements.chatHistory.innerHTML =
        '<div class="text-center text-muted small p-3">¡Comienza la conversación!</div>';
      return;
    }

    history.forEach((message) => {
      if (message.role === "user") {
        addChatMessage("user", message.content);
      } else {
        // --- APLICAMOS LA LÓGICA DE LIMPIEZA AQUÍ ---
        const formattedContent = renderComplexAssistantMessage(message.content);
        addChatMessage("assistant", formattedContent);
      }
    });
  } catch (error) {
    console.error(`Error al cargar el historial para ${projectName}:`, error);
    elements.chatHistory.innerHTML = `<div class="text-danger small p-3">${error.message}</div>`;
  }
}
