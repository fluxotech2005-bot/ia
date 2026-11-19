require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "database.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify({ projects: [] }, null, 2)
    );
}

function readDatabase() {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveDatabase(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function createId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 9);
}

// LISTAR PROJETOS
app.get("/api/projects", (req, res) => {
    const db = readDatabase();
    res.json(db.projects);
});

// CRIAR PROJETO
app.post("/api/projects", (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            error: "Informe o nome do projeto."
        });
    }

    const db = readDatabase();

    const project = {
        id: createId(),
        name: name.trim(),
        memory: "",
        messages: [],
        createdAt: new Date().toISOString()
    };

    db.projects.push(project);
    saveDatabase(db);

    res.status(201).json(project);
});

// SALVAR MEMÓRIA
app.patch("/api/projects/:id/memory", (req, res) => {
    const db = readDatabase();

    const project = db.projects.find(
        p => p.id === req.params.id
    );

    if (!project) {
        return res.status(404).json({
            error: "Projeto não encontrado."
        });
    }

    project.memory = String(req.body.memory || "");

    saveDatabase(db);

    res.json({ success: true });
});

// EDITAR RESPOSTA
app.patch("/api/projects/:id/messages/:messageId", (req, res) => {
    const db = readDatabase();

    const project = db.projects.find(
        p => p.id === req.params.id
    );

    if (!project) {
        return res.status(404).json({
            error: "Projeto não encontrado."
        });
    }

    const message = project.messages.find(
        m => m.id === req.params.messageId
    );

    if (!message) {
        return res.status(404).json({
            error: "Mensagem não encontrada."
        });
    }

    message.content = String(req.body.content || "");

    saveDatabase(db);

    res.json(message);
});

// EXCLUIR PROJETO
app.delete("/api/projects/:id", (req, res) => {
    const db = readDatabase();

    db.projects = db.projects.filter(
        p => p.id !== req.params.id
    );

    saveDatabase(db);

    res.json({ success: true });
});

// CONVERSAR COM A IA
app.post("/api/chat", async (req, res) => {
    try {
        const { projectId, message } = req.body;

        if (!projectId || !message || !message.trim()) {
            return res.status(400).json({
                error: "Projeto e mensagem são obrigatórios."
            });
        }

        const db = readDatabase();

        const project = db.projects.find(
            p => p.id === projectId
        );

        if (!project) {
            return res.status(404).json({
                error: "Projeto não encontrado."
            });
        }

        const {
            AI_API_KEY,
            AI_BASE_URL,
            AI_MODEL
        } = process.env;

        if (!AI_API_KEY || !AI_BASE_URL || !AI_MODEL) {
            return res.status(503).json({
                error: "A API da IA ainda não foi configurada."
            });
        }

        const systemPrompt = `
Você é a StoryVerse AI, uma assistente especializada
em escrita criativa, ficção e desenvolvimento de histórias.

Projeto: ${project.name}

MEMÓRIA DESTE PROJETO:
${project.memory || "Nenhuma memória cadastrada."}

Mantenha a continuidade dos personagens e acontecimentos.
Não misture informações de outros projetos.
Responda em português quando o usuário usar português.
`;

        const history = project.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await fetch(
            `${AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${AI_API_KEY}`
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...history,
                        { role: "user", content: message }
                    ],
                    temperature: 0.8
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error("Erro da API:", result);

            return res.status(502).json({
                error: result.error?.message || "Erro ao consultar a IA."
            });
        }

        const answer = result.choices?.[0]?.message?.content;

        if (!answer) {
            return res.status(502).json({
                error: "A IA não retornou uma resposta."
            });
        }

        const userMessage = {
            id: createId(),
            role: "user",
            content: message,
            createdAt: new Date().toISOString()
        };

        const assistantMessage = {
            id: createId(),
            role: "assistant",
            content: answer,
            createdAt: new Date().toISOString()
        };

        project.messages.push(userMessage, assistantMessage);

        saveDatabase(db);

        res.json({
            answer,
            messages: [userMessage, assistantMessage]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro interno do servidor."
        });
    }
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log("--------------------------------");
    console.log(" STORYVERSE AI INICIADA!");
    console.log(` http://localhost:${PORT}`);
    console.log("--------------------------------");
});