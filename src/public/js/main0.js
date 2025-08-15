document.addEventListener("DOMContentLoaded", () => {
  // --- Variables Globales ---
  let socket;
  let currentUserApiKey = localStorage.getItem("qwen_api_key") || "";
  let currentUserLiteLLMUrl = localStorage.getItem("qwen_litellm_url") || "";
  let currentProjectId = null;
  let currentProjectContext = null;
  let currentProjectModel = null;

  console.log("DEBUG: Variables globales inicializadas:", {
    currentUserApiKey: currentUserApiKey
      ? "***" + currentUserApiKey.slice(-4)
      : "null",
    currentUserLiteLLMUrl: currentUserLiteLLMUrl || "null",
  });

  // --- Elementos del DOM ---
  const loginForm = document.getElementById("loginForm");
  const loginAlert = document.getElementById("loginAlert");
  const dashboard = document.getElementById("dashboard"); // Asumiendo que el dashboard tiene este ID
  const loginPage = document.querySelector(".container.mt-5"); // Selector para la página de login
  const togglePasswordBtn = document.getElementById("togglePassword");
  const apiKeyInput = document.getElementById("apiKey");
  const rememberMeCheckbox = document.getElementById("rememberMe");

  // Dashboard Elements
  const newProjectLink = document.getElementById("newProjectLink");
  const settingsLink = document.getElementById("settingsLink");
  const projectsList = document.getElementById("projectsList");
  const startChatBtn = document.getElementById("startChatBtn");
  const stopChatBtn = document.getElementById("stopChatBtn");
  const chatTerminal = document.getElementById("chatTerminal");
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const projectContextPanel = document.getElementById("projectContextPanel");

  // Inicializar estado del chat (solo si los elementos existen)
  if (startChatBtn) {
    startChatBtn.disabled = true;
  }
  if (stopChatBtn) {
    stopChatBtn.disabled = true;
  }

  // Modal Elements (se inicializarán bajo demanda)
  let settingsModal = null;
  let newProjectModal = null;
  let settingsForm = null;
  let modelSelect = null;
  let themeSelect = null;
  let saveSettingsBtn = null;
  let newProjectForm = null;
  let createProjectBtn = null;
  let projectApiKeyInput = null; // Campo oculto

  // --- Funciones Auxiliares ---
  function showAlert(message, type = "error") {
    Swal.fire({
      icon: type === "success" ? "success" : "error",
      title: type === "success" ? "¡Éxito!" : "Error",
      text: message,
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener("mouseenter", Swal.stopTimer);
        toast.addEventListener("mouseleave", Swal.resumeTimer);
      },
    });
  }

  function showSuccess(message) {
    Swal.fire({
      icon: "success",
      title: "¡Éxito!",
      text: message,
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener("mouseenter", Swal.stopTimer);
        toast.addEventListener("mouseleave", Swal.resumeTimer);
      },
    });
  }

  function appendTerminalMessage(message, type = "system") {
    const p = document.createElement("p");
    p.className = `${type}-message`;
    p.textContent = message;
    chatTerminal.appendChild(p);
    chatTerminal.scrollTop = chatTerminal.scrollHeight;
  }

  function setChatActive(isActive) {
    userInput.disabled = !isActive;
    sendBtn.disabled = !isActive;
    startChatBtn.disabled = isActive;
    stopChatBtn.disabled = !isActive;
  }

  function loadProjects() {
    console.log(
      "DEBUG: Cargando proyectos para usuario:",
      currentUserApiKey ? "***" + currentUserApiKey.slice(-4) : "null"
    );

    if (!currentUserApiKey) {
      console.warn("DEBUG: No hay API Key disponible para cargar proyectos");
      projectsList.innerHTML =
        '<li class="nav-item"><a class="nav-link disabled" href="#">No hay sesión activa</a></li>';
      showAlert(
        "No hay sesión activa. Por favor, inicia sesión nuevamente.",
        "error"
      );
      return;
    }

    // Mostrar estado de carga
    projectsList.innerHTML =
      '<li class="nav-item"><a class="nav-link disabled" href="#">Cargando proyectos...</a></li>';

    fetch("/api/projects", {
      headers: {
        Authorization: `Bearer ${currentUserApiKey}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        console.log(
          "DEBUG: Respuesta de /api/projects:",
          response.status,
          response.statusText
        );
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Sesión expirada. Por favor, inicia sesión nuevamente."
            );
          } else if (response.status === 403) {
            throw new Error("No tienes permiso para acceder a los proyectos.");
          } else {
            throw new Error(
              `Error HTTP: ${response.status} ${response.statusText}`
            );
          }
        }
        return response.json();
      })
      .then((data) => {
        console.log("DEBUG: Datos recibidos de /api/projects:", data);
        console.log("DEBUG: Tipo de data.projects:", typeof data.projects);
        console.log(
          "DEBUG: ¿data.projects es un array?",
          Array.isArray(data.projects)
        );

        if (data.success) {
          projectsList.innerHTML = "";
          const projects = Array.isArray(data.projects) ? data.projects : [];

          if (projects.length === 0) {
            projectsList.innerHTML =
              '<li class="nav-item"><a class="nav-link disabled" href="#">No hay proyectos</a></li>';
            appendTerminalMessage(
              'No tienes proyectos creados. Haz clic en "Nuevo Proyecto" para crear uno.',
              "system"
            );
          } else {
            projects.forEach((project) => {
              const li = document.createElement("li");
              li.className =
                "nav-item d-flex justify-content-between align-items-center";

              const a = document.createElement("a");
              a.className = "nav-link";
              a.href = "#";
              a.textContent = project.name;
              a.dataset.projectId = project.id;
              a.dataset.projectStack = project.stack;
              a.dataset.projectDescription = project.description;
              a.addEventListener("click", (e) => {
                e.preventDefault();
                selectProject(a);
              });

              const deleteBtn = document.createElement("button");
              deleteBtn.className = "btn btn-sm btn-danger";
              deleteBtn.textContent = "Eliminar";
              deleteBtn.title = "Eliminar proyecto";
              deleteBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const confirmed = await Swal.fire({
                  title: `¿Eliminar proyecto "${project.name}"?`,
                  text: "Esta acción no se puede deshacer.",
                  icon: "warning",
                  showCancelButton: true,
                  confirmButtonColor: "#d33",
                  cancelButtonColor: "#3085d6",
                  confirmButtonText: "Sí, eliminar",
                  cancelButtonText: "Cancelar",
                });

                if (confirmed.isConfirmed) {
                  try {
                    const response = await fetch(
                      `/api/projects/${encodeURIComponent(project.name)}`,
                      {
                        method: "DELETE",
                        headers: {
                          Authorization: `Bearer ${currentUserApiKey}`,
                        },
                      }
                    );
                    const result = await response.json();
                    if (result.success) {
                      showSuccess(`Proyecto "${project.name}" eliminado.`);
                      loadProjects();
                    } else {
                      showAlert(
                        result.message || "Error al eliminar el proyecto."
                      );
                    }
                  } catch (error) {
                    showAlert("Error de red al eliminar el proyecto.");
                  }
                }
              });

              li.appendChild(a);
              li.appendChild(deleteBtn);
              projectsList.appendChild(li);
            });
            appendTerminalMessage(
              `Se cargaron ${projects.length} proyecto(s).`,
              "success"
            );
          }
        } else {
          console.warn("DEBUG: API devolvió success false:", data.message);
          projectsList.innerHTML = `<li class="nav-item"><a class="nav-link disabled" href="#">Error: ${data.message}</a></li>`;
          showAlert(data.message, "error");
        }
      })
      .catch((error) => {
        console.error("Error al cargar proyectos:", error);
        projectsList.innerHTML =
          '<li class="nav-item"><a class="nav-link disabled" href="#">Error al cargar</a></li>';
        showAlert(
          error.message ||
            "Error al cargar los proyectos. Por favor, intenta nuevamente.",
          "error"
        );
      });
  }

  function selectProject(projectLink) {
    document
      .querySelectorAll("#projectsList .nav-link")
      .forEach((link) => link.classList.remove("active"));
    projectLink.classList.add("active");

    currentProjectId = projectLink.dataset.projectId;
    currentProjectName = projectLink.textContent;
    currentProjectContext = {
      name: projectLink.textContent,
      stack: projectLink.dataset.projectStack,
      description: projectLink.dataset.projectDescription,
    };

    const projectContextPanel = document.getElementById("projectContextPanel");

    // Rellenamos con la información básica inmediatamente
    projectContextPanel.innerHTML = `
        <h6>Nombre:</h6><p>${currentProjectContext.name}</p>
        <h6>Stack:</h6><p>${currentProjectContext.stack}</p>
        <h6>Descripción:</h6><p>${currentProjectContext.description}</p>
    `;

    // Ahora, llamamos a la función para cargar los detalles adicionales desde la API
    loadProjectInfo(currentProjectName);

    appendTerminalMessage(
      `Proyecto seleccionado: ${currentProjectContext.name}`,
      "system"
    );
    document.getElementById("startChatBtn").disabled = false;
  }

  async function loadProjectInfo(projectName) {
    if (!projectName) return;
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/info`,
        {
          headers: { Authorization: `Bearer ${currentUserApiKey}` },
        }
      );
      if (!response.ok) {
        throw new Error(
          "No se pudo obtener la información detallada del proyecto."
        );
      }
      const result = await response.json();
      if (result.success && result.project) {
        // Aquí puedes actualizar la UI con la información detallada
        // Por ejemplo, el panel de "Estado del Proyecto"
        const selectedModelEl = document.getElementById("selectedModel");
        const projectStatusEl = document.getElementById("projectStatus");
        const tokensUsedEl = document.getElementById("tokensUsed");

        if (selectedModelEl) {
          selectedModelEl.textContent =
            result.project.envConfig.OPENAI_MODEL || "No definido";
        }
        if (projectStatusEl) {
          projectStatusEl.innerHTML =
            '<span class="badge bg-secondary">Sin iniciar</span>';
        }
        if (tokensUsedEl) {
          tokensUsedEl.textContent = "0"; // O un valor futuro
        }
        console.log("Info detallada del proyecto cargada:", result.project);
      }
    } catch (error) {
      console.error("Error en loadProjectInfo:", error);
      showAlert(
        "No se pudo cargar la información detallada del proyecto.",
        "error"
      );
    }
  }


  // --- Funciones de Login ---
//   function saveCredentialsToStorage(apiKey, litellmUrl, rememberMe) {
//     if (rememberMe) {
//       localStorage.setItem("qwen_api_key", apiKey);
//       localStorage.setItem("qwen_litellm_url", litellmUrl);
//       localStorage.setItem("qwen_remember_me", "true");
//       localStorage.setItem("qwen_default_model", "all-team-models");
//     } else {
//       localStorage.removeItem("qwen_api_key");
//       localStorage.removeItem("qwen_litellm_url");
//       localStorage.removeItem("qwen_remember_me");
//       localStorage.removeItem("qwen_default_model");
//     }
//   }

  // Función para verificar si estamos en el dashboard
  function isDashboardPage() {
    return document.getElementById("dashboard") !== null;
  }

  function loadCredentialsFromStorage() {
    const apiKey = localStorage.getItem("qwen_api_key");
    const litellmUrl = localStorage.getItem("qwen_litellm_url");
    // Comprobamos si el usuario marcó "Recuérdame" O si tiene una sesión temporal activa
    const rememberMe = localStorage.getItem("qwen_remember_me") === "true";
    const isLoggedInTemporarily =
      sessionStorage.getItem("isLoggedIn") === "true";

    if (apiKey && litellmUrl && (rememberMe || isLoggedInTemporarily)) {
      currentUserApiKey = apiKey;
      currentUserLiteLLMUrl = litellmUrl;
      console.log("DEBUG: Credenciales cargadas.");
      return true;
    }
    console.log("DEBUG: No se encontraron credenciales válidas.");
    return false;
  }

  function togglePasswordVisibility() {
    const type = apiKeyInput.type === "password" ? "text" : "password";
    apiKeyInput.type = type;
    const icon = togglePasswordBtn.querySelector("i");
    icon.className = type === "password" ? "bi bi-eye" : "bi bi-eye-slash";
  }

  // --- Lógica de Login ---
  if (loginForm) {
    // Cargar credenciales guardadas si existen
    loadCredentialsFromStorage();

    // Event listener para mostrar/ocultar contraseña
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener("click", togglePasswordVisibility);
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const apiKeyInput = document.getElementById("apiKey");
      const litellmUrlInput = document.getElementById("litellmUrl");
      const rememberMeCheckbox = document.getElementById("rememberMe");

      const apiKey = apiKeyInput.value.trim();
      const litellmUrl = litellmUrlInput.value.trim();
      const rememberMe = rememberMeCheckbox.checked;

      if (!apiKey || !litellmUrl) {
        showAlert("Por favor, completa la URL y la API Key.");
        return;
      }

      // Lógica de guardado modificada
      if (rememberMe) {
        localStorage.setItem("qwen_api_key", apiKey);
        localStorage.setItem("qwen_litellm_url", litellmUrl);
        localStorage.setItem("qwen_remember_me", "true");
        sessionStorage.removeItem("isLoggedIn"); // Limpiamos el indicador temporal si no es necesario
      } else {
        // Si no se marca "Recuérdame", usamos localStorage para pasar los datos entre páginas,
        // pero sessionStorage para saber que es una sesión temporal.
        localStorage.setItem("qwen_api_key", apiKey);
        localStorage.setItem("qwen_litellm_url", litellmUrl);
        localStorage.removeItem("qwen_remember_me");
        sessionStorage.setItem("isLoggedIn", "true");
      }

      try {
        const response = await fetch("/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, litellmUrl }),
        });

        const result = await response.json();

        if (result.success) {
          window.location.href = result.redirectUrl;
        } else {
          showAlert(result.message || "Error en la conexión.");
        }
      } catch (error) {
        showAlert("Error de red. No se pudo conectar al servidor.");
      }
    });
  }

  // --- Lógica del Dashboard ---
  if (isDashboardPage()) {
    console.log("DEBUG: Inicializando lógica del dashboard");

    // Inicializar variables del modal
    settingsForm = document.getElementById("settingsForm");
    modelSelect = document.getElementById("modelSelect");
    themeSelect = document.getElementById("themeSelect");
    saveSettingsBtn = document.getElementById("saveSettingsBtn");
    newProjectForm = document.getElementById("newProjectForm");
    createProjectBtn = document.getElementById("createProjectBtn");
    projectApiKeyInput = document.getElementById("projectApiKey");

    // Verificar si el usuario está autenticado
    if (!currentUserApiKey) {
      console.warn(
        "DEBUG: No hay API Key de usuario. Redirigiendo al login..."
      );
      window.location.href = "/";
      return;
    }

    // Verificar elementos del dashboard
    console.log("DEBUG: Elemento newProjectLink encontrado:", newProjectLink);

    // Inicializar Socket.IO
    try {
      socket = io();
      console.log("DEBUG: Socket.IO inicializado correctamente");
    } catch (error) {
      console.error("ERROR: No se pudo inicializar Socket.IO:", error);
      appendTerminalMessage(
        "Error de conexión con el servidor. Por favor, recarga la página.",
        "error"
      );
    }

    socket.on("connect", () => {
      console.log("Conectado al servidor Socket.IO");
      appendTerminalMessage("Conectado al servidor.", "system");
    });

    socket.on("disconnect", () => {
      console.log("Desconectado del servidor Socket.IO");
      appendTerminalMessage(
        "Desconectado del servidor. Reconectando...",
        "warning"
      );
      setChatActive(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Error de conexión Socket.IO:", error);
      appendTerminalMessage(
        "Error de conexión con el servidor. Intentando reconectar...",
        "error"
      );
    });

    socket.on("reconnect", () => {
      console.log("Reconectado al servidor Socket.IO");
      appendTerminalMessage("Reconectado al servidor.", "success");
    });

    socket.on("agentMessage", (data) => {
      appendTerminalMessage(data.data, data.type);
      if (data.type === "close" || data.type === "error") {
        setChatActive(false);
      }
    });

    // Cargar proyectos al iniciar el dashboard
    loadProjects();

    // Event Listeners del Dashboard
    newProjectLink.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("DEBUG: Botón Nuevo Proyecto clickeado");

      // Verificar que el elemento existe
      const modalElement = document.getElementById("newProjectModal");
      console.log("DEBUG: Elemento modal encontrado:", modalElement);

      if (!modalElement) {
        console.error("ERROR: Modal no encontrado en el DOM");
        return;
      }

      // Inicializar el modal si no existe
      if (!newProjectModal) {
        newProjectModal = new bootstrap.Modal(modalElement);
        console.log("DEBUG: Modal inicializado");
      }

      // Establecer la API Key en el campo oculto del modal
      if (projectApiKeyInput && currentUserApiKey) {
        projectApiKeyInput.value = currentUserApiKey;
        console.log("DEBUG: API Key establecida en el modal");
      }

      try {
        newProjectModal.show();
        console.log("DEBUG: Modal mostrado exitosamente");
      } catch (error) {
        console.error("ERROR al mostrar modal:", error);
      }
    });

    // Event listener para cerrar sesión
    const logoutLink = document.getElementById("logoutLink");
    if (logoutLink) {
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("DEBUG: Botón Cerrar Sesión clickeado");

        // Mostrar confirmación con SweetAlert2
        Swal.fire({
          title: "¿Cerrar sesión?",
          text: "¿Estás seguro de que quieres cerrar sesión?",
          icon: "question",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Sí, cerrar sesión",
          cancelButtonText: "Cancelar",
        }).then((result) => {
          if (result.isConfirmed) {
            console.log("DEBUG: Cerrando sesión...");

            // Limpiar datos de sesión
            currentUserApiKey = "";
            currentUserLiteLLMUrl = "";
            currentProjectId = null;
            currentProjectContext = null;

            // Limpiar localStorage
            localStorage.removeItem("currentUserApiKey");
            localStorage.removeItem("currentUserLitellmUrl");
            localStorage.removeItem("qwen_api_key");
            localStorage.removeItem("qwen_litellm_url");
            localStorage.removeItem("qwen_remember_me");

            // Cerrar conexión Socket.IO
            if (socket) {
              socket.disconnect();
            }

            // Redirigir al login
            window.location.href = "/";
          }
        });
      });
    }

    if (settingsLink) {
      settingsLink.addEventListener("click", (e) => {
        e.preventDefault();
        // Inicializar el modal si no existe
        if (!settingsModal) {
          settingsModal = new bootstrap.Modal(
            document.getElementById("settingsModal")
          );
        }

        // Cargar modelos disponibles
        if (modelSelect) {
          modelSelect.innerHTML =
            '<option value="" selected disabled>Cargando modelos...</option>';
          fetch(
            `/api/models?litellmUrl=${encodeURIComponent(
              currentUserLiteLLMUrl
            )}&apiKey=${encodeURIComponent(currentUserApiKey)}`
          )
            .then((response) => response.json())
            .then((data) => {
              if (data.success && data.data.data) {
                modelSelect.innerHTML = "";
                data.data.data.forEach((model) => {
                  const option = document.createElement("option");
                  option.value = model.id;
                  option.textContent = model.id;
                  modelSelect.appendChild(option);
                });
                // Seleccionar modelo por defecto guardado
                const defaultModel = localStorage.getItem("qwen_default_model");
                if (defaultModel) {
                  modelSelect.value = defaultModel;
                }
              } else {
                modelSelect.innerHTML =
                  '<option value="" disabled>Error al cargar modelos</option>';
              }
            })
            .catch((error) => {
              console.error("Error al cargar modelos:", error);
              modelSelect.innerHTML =
                '<option value="" disabled>Error de red</option>';
            });
        }

        // Cargar modelo para el proyecto actual
        if (currentProjectName && currentProjectModel) {
          currentProjectModel.disabled = false;
          currentProjectModel.innerHTML =
            '<option value="" selected disabled>Cargando modelo actual...</option>';

          // Obtener modelo actual del proyecto
          fetch(
            `/api/projects/${encodeURIComponent(currentProjectName)}/info`,
            {
              headers: {
                Authorization: `Bearer ${currentUserApiKey}`,
                "Content-Type": "application/json",
              },
            }
          )
            .then((response) => response.json())
            .then((data) => {
              if (data.success && data.project.envConfig.OPENAI_MODEL) {
                currentProjectModel.innerHTML = "";
                // Cargar todos los modelos disponibles
                fetch(
                  `/api/models?litellmUrl=${encodeURIComponent(
                    currentUserLiteLLMUrl
                  )}&apiKey=${encodeURIComponent(currentUserApiKey)}`
                )
                  .then((response) => response.json())
                  .then((modelsData) => {
                    if (modelsData.success && modelsData.data.data) {
                      modelsData.data.data.forEach((model) => {
                        const option = document.createElement("option");
                        option.value = model.id;
                        option.textContent = model.id;
                        if (model.id === data.project.envConfig.OPENAI_MODEL) {
                          option.selected = true;
                        }
                        currentProjectModel.appendChild(option);
                      });
                    }
                  });
              }
            })
            .catch((error) => {
              console.error("Error al cargar modelo del proyecto:", error);
            });
        }

        settingsModal.show();
      });
    }

    if (startChatBtn) {
      startChatBtn.addEventListener("click", () => {
        if (!currentProjectId) {
          appendTerminalMessage(
            "Por favor, selecciona un proyecto primero.",
            "warning"
          );
          return;
        }
        appendTerminalMessage("Iniciando sesión de chat...", "system");
        socket.emit("startChat", {
          apiKey: currentUserApiKey,
          projectId: currentProjectName, // Usar el nombre del proyecto en lugar del ID
          projectContext: currentProjectContext,
        });
        setChatActive(true);
      });
    }

    if (stopChatBtn) {
      stopChatBtn.addEventListener("click", () => {
        socket.emit("stopChat");
        appendTerminalMessage("Deteniendo sesión de chat...", "system");
        setChatActive(false);
      });
    }

    if (sendBtn && userInput) {
      sendBtn.addEventListener("click", sendMessage);
      userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    function sendMessage() {
      const message = userInput.value.trim();
      if (!message) {
        return;
      }

      if (!socket) {
        appendTerminalMessage(
          "Error: No hay conexión con el servidor. Por favor, recarga la página.",
          "error"
        );
        return;
      }

      if (!socket.connected) {
        appendTerminalMessage(
          "Error: No estás conectado al servidor. Intentando reconectar...",
          "error"
        );
        return;
      }

      try {
        appendTerminalMessage(`> ${message}`, "user");
        socket.emit("userMessage", { message });
        userInput.value = "";
      } catch (error) {
        console.error("Error al enviar mensaje:", error);
        appendTerminalMessage(
          "Error al enviar el mensaje. Por favor, intenta nuevamente.",
          "error"
        );
      }
    }

    // Lógica de los Modales
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", async () => {
        const selectedModel = modelSelect ? modelSelect.value : null;
        const selectedTheme = themeSelect ? themeSelect.value : null;
        const currentProjectSelectedModel = currentProjectModel
          ? currentProjectModel.value
          : null;

        console.log("Ajustes guardados:", {
          defaultModel: selectedModel,
          theme: selectedTheme,
          projectModel: currentProjectSelectedModel,
        });

        // Guardar modelo por defecto en localStorage
        if (selectedModel) {
          localStorage.setItem("qwen_default_model", selectedModel);
        }

        // Actualizar modelo para el proyecto actual
        if (currentProjectName && currentProjectSelectedModel) {
          try {
            const response = await fetch(
              `/api/projects/${encodeURIComponent(currentProjectName)}/config`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${currentUserApiKey}`,
                },
                body: JSON.stringify({
                  apiKey: currentUserApiKey,
                  litellmUrl: currentUserLiteLLMUrl,
                  selectedModel: currentProjectSelectedModel,
                }),
              }
            );

            if (response.ok) {
              Swal.fire({
                icon: "success",
                title: "¡Actualizado!",
                text: "La configuración del proyecto se actualizó correctamente.",
                timer: 2000,
                showConfirmButton: false,
              });
            } else {
              throw new Error(
                "No se pudo actualizar la configuración del proyecto"
              );
            }
          } catch (error) {
            console.error(
              "Error al actualizar configuración del proyecto:",
              error
            );
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "No se pudo actualizar la configuración del proyecto.",
            });
          }
        }

        // Guardar tema
        if (selectedTheme) {
          document.documentElement.setAttribute("data-bs-theme", selectedTheme);
          localStorage.setItem("theme", selectedTheme);
        }

        if (settingsModal) {
          settingsModal.hide();
        }
      });
    }

    if (createProjectBtn) {
      createProjectBtn.addEventListener("click", async () => {
        const name = document.getElementById("projectName").value;
        const stack = document.getElementById("projectStack").value;
        const description = document.getElementById("projectDescription").value;
        const apiKey = projectApiKeyInput.value;

        // Validación básica
        if (!name || !stack || !description) {
          Swal.fire({
            icon: "warning",
            title: "Campos incompletos",
            text: "Por favor completa todos los campos del formulario.",
          });
          return;
        }

        if (!apiKey) {
          Swal.fire({
            icon: "error",
            title: "Error de sesión",
            text: "No se pudo obtener la API Key. Por favor, inicia sesión nuevamente.",
          });
          return;
        }

        try {
          console.log("Enviando solicitud para crear proyecto:", {
            name,
            stack,
            description,
            apiKey,
          });

          // Mostrar indicador de carga
          const loadingSwal = Swal.fire({
            title: "Creando proyecto...",
            text: "Por favor espera un momento.",
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              stack,
              description,
              apiKey,
              litellmUrl: currentUserLiteLLMUrl,
            }),
          });

          console.log("Respuesta del servidor:", response.status);
          const result = await response.json();
          console.log("Resultado de la creación:", result);

          loadingSwal.close();

          if (result.success) {
            newProjectModal.hide();
            newProjectForm.reset();

            // Forzar recarga de proyectos con un pequeño retraso
            setTimeout(() => {
              console.log(
                "DEBUG: Forzando recarga de proyectos después de crear..."
              );
              loadProjects();
            }, 500);

            appendTerminalMessage(
              `Proyecto "${name}" creado exitosamente.`,
              "success"
            );

            Swal.fire({
              icon: "success",
              title: "¡Proyecto creado!",
              text: `El proyecto "${name}" se ha creado exitosamente.`,
              timer: 3000,
              showConfirmButton: false,
              position: "top-end",
            });
          } else {
            Swal.fire({
              icon: "error",
              title: "Error al crear proyecto",
              text: result.message || "Error desconocido",
            });
          }
        } catch (error) {
          console.error("Error al crear proyecto:", error);
          let errorMessage = "Error al crear el proyecto.";

          if (error.name === "TypeError" && error.message.includes("fetch")) {
            errorMessage = "Error de red. No se pudo conectar con el servidor.";
          } else if (error.message.includes("Failed to fetch")) {
            errorMessage =
              "Error de conexión. Por favor, verifica tu conexión a internet.";
          } else {
            errorMessage = `Error: ${error.message}`;
          }

          Swal.fire({
            icon: "error",
            title: "Error",
            text: errorMessage,
          });
        }
      });
    }
  }

  // --- Inicialización del Tema ---
  let savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-bs-theme", savedTheme);
  if (themeSelect && isDashboardPage()) {
    themeSelect.value = savedTheme;
  }
});
