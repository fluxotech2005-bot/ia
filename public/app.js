// ========================================
// STORYVERSE AI
// Sistema principal do aplicativo
// ========================================

const projectList = document.getElementById("projectList");
const welcome = document.getElementById("welcome");
const chat = document.getElementById("chat");
const messages = document.getElementById("messages");

const projectDialog = document.getElementById("projectDialog");
const memoryDialog = document.getElementById("memoryDialog");

let projects = [];
let activeProject = null;
let loading = false;

// ========================================
// COMUNICAÇÃO COM O SERVIDOR
// ========================================

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Erro na solicitação.");
    }

    return result;
}

// ========================================
// CARREGAR PROJETOS
// ========================================

async function loadProjects() {
    try {
        projects = await api("/api/projects");
        renderProjects();
    } catch (error) {
        alert("Erro ao carregar projetos: " + error.message);
    }
}

// ========================================
// MOSTRAR PROJETOS NA LATERAL
// ========================================

function renderProjects() {
    projectList.innerHTML = "";

    projects.forEach(project => {
        const item = document.createElement("div");

        item.className = "project-item" +
            (activeProject?.id === project.id ? " active" : "");

        const open = document.createElement("button");

        open.className = "project-item";
        open.textContent = "✦ " + project.name;
        open.style.flex = "1";

        open.onclick = () => {
            selectProject(project.id);
        };

        const remove = document.createElement("button");

        remove.className = "delete-project";
        remove.textContent = "×";
        remove.title = "Excluir projeto";

        remove.onclick = async () => {
            const confirmDelete = confirm(
                "Deseja excluir este projeto e seu histórico?"
            );

            if (!confirmDelete) return;

            try {
                await api(`/api/projects/${project.id}`, {
                    method: "DELETE"
                });

                if (activeProject?.id === project.id) {
                    showWelcome();
                }

                await loadProjects();

            } catch (error) {
                alert(error.message);
            }
        };

        item.append(open, remove);
        projectList.appendChild(item);
    });
}

// ========================================
// TELA INICIAL
// ========================================

function showWelcome() {
    welcome.classList.remove("hidden");
    chat.classList.add("hidden");

    activeProject = null;

    renderProjects();
}

// ========================================
// ABRIR PROJETO
// ========================================

async function selectProject(id) {
    activeProject = projects.find(project => project.id === id);

    if (!activeProject) return;

    welcome.classList.add("hidden");
    chat.classList.remove("hidden");

    renderProjects();
    renderMessages();
}

// ========================================
// MOSTRAR CONVERSAS
// ========================================

function renderMessages() {
    messages.innerHTML = "";

    if (!activeProject) return;

    activeProject.messages.forEach(message => {
        const element = document.createElement("article");

        element.className = "message " + message.role;

        const label = document.createElement("div");

        label.className = "message-label";

        label.textContent = message.role === "user"
            ? "Você"
            : "StoryVerse AI";

        const content = document.createElement("div");

        content.className = "message-content";
        content.textContent = message.content;

        element.append(label, content);

        // BOTÃO EDITAR RESPOSTA

        if (message.role === "assistant") {
            const edit = document.createElement("button");

            edit.className = "edit-message";
            edit.textContent = "Editar resposta";

            edit.onclick = async () => {
                const updated = prompt(
                    "Edite sua resposta:",
                    message.content
                );

                if (updated === null) return;

                try {
                    await api(
                        `/api/projects/${activeProject.id}/messages/${message.id}`,
                        {
                            method: "PATCH",
                            body: JSON.stringify({
                                content: updated
                            })
                        }
                    );

                    message.content = updated;

                    renderMessages();

                } catch (error) {
                    alert(error.message);
                }
            };

            element.appendChild(edit);
        }

        messages.appendChild(element);
    });

    messages.scrollTop = messages.scrollHeight;
}

// ========================================
// CRIAR NOVO PROJETO
// ========================================

function openProjectDialog() {
    projectDialog.showModal();

    document.getElementById("projectName").focus();
}

document.getElementById("newProject").onclick = openProjectDialog;

document.getElementById("welcomeProject").onclick = openProjectDialog;

document.getElementById("cancelProject").onclick = () => {
    projectDialog.close();
};

document.getElementById("projectForm").onsubmit = async event => {
    event.preventDefault();

    const name = document.getElementById("projectName").value.trim();

    if (!name) return;

    try {
        const project = await api("/api/projects", {
            method: "POST",
            body: JSON.stringify({ name })
        });

        projectDialog.close();

        document.getElementById("projectForm").reset();

        await loadProjects();

        selectProject(project.id);

    } catch (error) {
        alert(error.message);
    }
};

// ========================================
// ENVIAR MENSAGEM PARA A IA
// ========================================

document.getElementById("chatForm").onsubmit = async event => {
    event.preventDefault();

    if (loading || !activeProject) return;

    const input = document.getElementById("messageInput");

    const button = document.getElementById("sendButton");

    const message = input.value.trim();

    if (!message) return;

    loading = true;

    button.disabled = true;
    button.textContent = "Pensando...";

    input.value = "";

    const temporaryMessage = {
        role: "user",
        content: message
    };

    activeProject.messages.push(temporaryMessage);

    renderMessages();

    try {
        const result = await api("/api/chat", {
            method: "POST",
            body: JSON.stringify({
                projectId: activeProject.id,
                message: message
            })
        });

        activeProject.messages.pop();

        activeProject.messages.push(...result.messages);

        renderMessages();

    } catch (error) {
        activeProject.messages.pop();

        input.value = message;

        renderMessages();

        alert(error.message);

    } finally {
        loading = false;

        button.disabled = false;
        button.textContent = "Enviar ↑";
    }
};

// ========================================
// MEMÓRIA INDIVIDUAL DO PROJETO
// ========================================

document.getElementById("memoryButton").onclick = () => {
    if (!activeProject) {
        alert("Primeiro selecione um projeto.");
        return;
    }

    document.getElementById("memoryInput").value =
        activeProject.memory || "";

    memoryDialog.showModal();
};

document.getElementById("closeMemory").onclick = () => {
    memoryDialog.close();
};

// ========================================
// SALVAR MEMÓRIA
// ========================================

document.getElementById("memoryForm").onsubmit = async event => {
    event.preventDefault();

    if (!activeProject) return;

    const memory = document.getElementById("memoryInput").value;

    try {
        await api(`/api/projects/${activeProject.id}/memory`, {
            method: "PATCH",
            body: JSON.stringify({ memory })
        });

        activeProject.memory = memory;

        memoryDialog.close();

        alert("Memória salva com sucesso!");

    } catch (error) {
        alert(error.message);
    }
};

// ========================================
// INICIAR APLICAÇÃO
// ========================================

loadProjects();

console.log("StoryVerse AI carregada!");