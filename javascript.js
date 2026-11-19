app.post("/api/chat", async (req, res) => {
    try {
        const { projectId } = req.body;

        const project = db.projects.find(
            p => p.id === projectId
        );

        if (!project) {
            return res.status(404).json({
                error: "Projeto não encontrado."
            });
        }

        const AI_API_KEY = "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";
        const AI_BASE_URL = "https://api.openai.com/v1";
        const AI_MODEL = "gpt-4o-mini";

        if (!AI_API_KEY || !AI_BASE_URL || !AI_MODEL) {
            return res.status(503).json({
                error: "A API da IA ainda não foi configurada."
            });
        }

        const systemPrompt = `
Você é a StoryVerse AI, uma assistente especializada em escrita criativa, ficção e desenvolvimento de histórias.

Projeto: ${project.name}

MEMÓRIA DESTE PROJETO:
${project.memory || "Nenhuma memória cadastrada."}

Mantenha a continuidade dos personagens e acontecimentos.
Não misture informações de outros projetos.
Responda em português quando o usuário usar português.
        `.trim();

        // O restante do seu código da IA continua aqui embaixo...

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
});