import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env do diretório raiz do projeto
dotenv.config({ path: resolve(__dirname, "..", ".env") });

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY não configurada no .env");
}
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY não configurada no .env");
}
const anthropic = new Anthropic(); // usa ANTHROPIC_API_KEY do env
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function retry(fn, retries = 2, delay = 2000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.log(`   🔄 Retry ${i + 1}/${retries} após erro: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
}

async function callClaude(model, systemPrompt, userMessage) {
  return retry(async () => {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    return res.content[0].text;
  });
}

async function callGemini(prompt) {
  return retry(async () => {
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    const res = await model.generateContent(prompt);
    return res.response.text();
  });
}

// ---------------------------------------------------------------------------
// 1) OPUS — Planeja e classifica as subtarefas
// ---------------------------------------------------------------------------
const OPUS_SYSTEM = `Você é o Tech Lead de um time de agentes de IA.
Sua função é receber uma tarefa e devolver um plano JSON com subtarefas.

Classifique cada subtarefa como:
- "hard"  → lógica complexa, arquitetura, debug, segurança, refactor pesado
- "easy"  → docs, boilerplate, CRUD simples, configs, testes unitários simples

Responda APENAS com JSON válido, sem markdown, sem explicação. Formato:

{
  "objetivo": "resumo do objetivo geral",
  "subtarefas": [
    {
      "id": 1,
      "titulo": "descrição curta",
      "detalhes": "o que fazer exatamente",
      "dificuldade": "hard" | "easy",
      "dependencias": []
    }
  ]
}`;

export async function plan(taskDescription) {
  console.log("\n🧠 [OPUS] Planejando...\n");
  const raw = await callClaude(
    "claude-opus-4-20250918",
    OPUS_SYSTEM,
    taskDescription
  );

  // Extrair JSON mesmo se vier com ```json
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Opus retornou JSON inválido no planejamento: ${jsonStr.slice(0, 200)}`);
  }
  if (!parsed.subtarefas || !Array.isArray(parsed.subtarefas)) {
    throw new Error(`Opus retornou estrutura inesperada: falta campo 'subtarefas'`);
  }
  console.log(`   📋 ${parsed.subtarefas.length} subtarefas criadas`);
  for (const t of parsed.subtarefas) {
    const icon = t.dificuldade === "hard" ? "🔴" : "🟢";
    console.log(`   ${icon} [${t.dificuldade.toUpperCase()}] ${t.titulo}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// 2) SONNET — Executa tarefas difíceis
// ---------------------------------------------------------------------------
const SONNET_SYSTEM = `Você é um engenheiro de software sênior.
Recebe uma tarefa técnica e entrega código/solução de alta qualidade.
Seja direto — entregue o resultado pronto para uso.
Se precisar criar/editar arquivos, indique claramente o caminho e conteúdo.`;

async function executeSonnet(subtask) {
  console.log(`\n⚡ [SONNET] Executando: ${subtask.titulo}`);
  const prompt = `Tarefa: ${subtask.titulo}\n\nDetalhes: ${subtask.detalhes}`;
  const result = await callClaude("claude-sonnet-4-20250514", SONNET_SYSTEM, prompt);

  console.log(`   ✅ Sonnet concluiu: ${subtask.titulo}`);
  return result;
}

// ---------------------------------------------------------------------------
// 3) GEMINI — Executa tarefas fáceis
// ---------------------------------------------------------------------------
async function executeGemini(subtask) {
  console.log(`\n💚 [GEMINI] Executando: ${subtask.titulo}`);
  const prompt = `Você é um dev assistente. Seja direto e entregue o resultado pronto.

Tarefa: ${subtask.titulo}

Detalhes: ${subtask.detalhes}`;
  const result = await callGemini(prompt);
  console.log(`   ✅ Gemini concluiu: ${subtask.titulo}`);
  return result;
}

// ---------------------------------------------------------------------------
// 4) OPUS — Revisa os resultados
// ---------------------------------------------------------------------------
const REVIEW_SYSTEM = `Você é o Tech Lead revisando entregas do seu time.
Para cada resultado, avalie:
- Qualidade do código/solução
- Possíveis problemas ou melhorias
- Se atende ao que foi pedido

Responda APENAS com JSON válido:
{
  "aprovados": [{ "id": 1, "comentario": "..." }],
  "revisoes": [{ "id": 2, "problema": "...", "sugestao": "..." }]
}`;

export async function review(planObj, results) {
  console.log("\n🧠 [OPUS] Revisando entregas...\n");

  const reviewPrompt = planObj.subtarefas
    .map((t, i) => `### Subtarefa ${t.id}: ${t.titulo}\nResultado:\n${results[i]}`)
    .join("\n\n---\n\n");

  const raw = await callClaude("claude-opus-4-20250918", REVIEW_SYSTEM, reviewPrompt);
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Opus retornou JSON inválido na revisão: ${jsonStr.slice(0, 200)}`);
  }

  console.log(`   ✅ Aprovados: ${parsed.aprovados?.length || 0}`);
  console.log(`   🔄 Com revisão: ${parsed.revisoes?.length || 0}`);

  if (parsed.revisoes?.length) {
    for (const r of parsed.revisoes) {
      console.log(`   ⚠  Tarefa ${r.id}: ${r.problema}`);
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Pipeline completo: Plan → Execute → Review
// ---------------------------------------------------------------------------
export async function runPipeline(taskDescription) {
  const startTime = Date.now();

  // 1. Opus planeja
  const planResult = await plan(taskDescription);

  // 2. Executar subtarefas (paralelas quando sem dependências)
  const results = new Array(planResult.subtarefas.length);
  const completed = new Set();

  async function executeSubtask(subtask) {
    // Aguardar dependências
    while (subtask.dependencias?.length) {
      const pending = subtask.dependencias.filter((d) => !completed.has(d));
      if (pending.length === 0) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    const result =
      subtask.dificuldade === "hard"
        ? await executeSonnet(subtask)
        : await executeGemini(subtask);

    completed.add(subtask.id);
    return result;
  }

  const promises = planResult.subtarefas.map(async (subtask, i) => {
    results[i] = await executeSubtask(subtask);
  });
  await Promise.all(promises);

  // 3. Opus revisa
  const reviewResult = await review(planResult, results);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱  Pipeline concluído em ${elapsed}s\n`);

  return {
    plano: planResult,
    resultados: planResult.subtarefas.map((t, i) => ({
      subtarefa: t,
      executadoPor: t.dificuldade === "hard" ? "sonnet" : "gemini",
      resultado: results[i],
    })),
    revisao: reviewResult,
    tempoSegundos: parseFloat(elapsed),
  };
}

// ---------------------------------------------------------------------------
// Execução direta via CLI
// ---------------------------------------------------------------------------
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__dirname, "orchestrator.js");
if (isMain) {
  const task = process.argv.slice(2).join(" ");
  if (!task) {
    console.log("Uso: node orchestrator.js <descrição da tarefa>");
    process.exit(1);
  }
  runPipeline(task)
    .then((output) => {
      writeFileSync("output.json", JSON.stringify(output, null, 2));
      console.log("📄 Resultado salvo em output.json");
    })
    .catch((err) => {
      console.error("❌ Erro:", err.message);
      process.exit(1);
    });
}
