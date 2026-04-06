import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { plan, review, runPipeline } from "./orchestrator.js";

const server = new McpServer({
  name: "agent-team",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: agent_team_run — Pipeline completo (Plan → Execute → Review)
// ---------------------------------------------------------------------------
server.tool(
  "agent_team_run",
  "Executa o pipeline completo: Opus planeja, Sonnet/Gemini executam, Opus revisa",
  { task: z.string().describe("Descrição da tarefa a ser executada pelo time") },
  async ({ task }) => {
    try {
      const result = await runPipeline(task);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro no pipeline: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: agent_team_plan — Só o planejamento do Opus
// ---------------------------------------------------------------------------
server.tool(
  "agent_team_plan",
  "Opus analisa a tarefa e cria um plano com subtarefas classificadas (hard/easy)",
  { task: z.string().describe("Descrição da tarefa para planejamento") },
  async ({ task }) => {
    try {
      const result = await plan(task);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro no planejamento: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: agent_team_review — Opus revisa resultados
// ---------------------------------------------------------------------------
server.tool(
  "agent_team_review",
  "Opus revisa os resultados de tarefas já executadas",
  {
    plan: z.string().describe("JSON do plano original (output do agent_team_plan)"),
    results: z.array(z.string()).describe("Array com o resultado de cada subtarefa"),
  },
  async ({ plan: planJson, results }) => {
    try {
      const planObj = JSON.parse(planJson);
      const result = await review(planObj, results);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Erro na revisão: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Agent Team MCP Server rodando via stdio");
}

main().catch((err) => {
  console.error("❌ Falha ao iniciar:", err);
  process.exit(1);
});
