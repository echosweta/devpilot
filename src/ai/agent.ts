import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ai = new OpenAI({
  baseURL: "http://127.0.0.1:11434/v1",
  apiKey: "ollama"
});

const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";

export async function investigateWithAI(question: string) {
  const mcpClient = new Client({
    name: "devpilot-ai-client",
    version: "1.0.0"
  });

  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );

  const transport = new StdioClientTransport({
    command: "npm",
    args: ["run", "mcp"],
    cwd: process.cwd(),
    env
  });

  try {
    await mcpClient.connect(transport);

    const { tools } = await mcpClient.listTools();

    const aiTools: ChatCompletionTool[] = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.inputSchema as any
      }
    }));

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `
          You are DevPilot, an engineering incident investigation assistant.

          INVESTIGATION RULES:
          1. Always use MCP tools to retrieve real logs and metrics before writing a report.
          2. If the user specifies an endpoint and time window, pass BOTH filters to every relevant metrics and investigation tool.
          3. Use the same endpoint and time window for all metrics.
          4. Never use global metrics when the user requests endpoint-specific metrics.
          5. Never invent logs, metrics, timestamps, or deployment details.
          6. Distinguish failedRequests (HTTP 4xx + 5xx) from serverErrors (HTTP 5xx).
          7. Separate observed facts from possible explanations.
          8. Never claim a root cause is confirmed without evidence.
          9. Do not claim the database is healthy just because an error was not found.
          10. Deployment investigations must use correlate_deployment.
          11. When a version is mentioned, use service and version fields, never version as deploymentId.
          12. Use actual beforeDeployment and afterDeployment metrics.
          13. Correlation does not prove causation.


          REPORT FORMAT:
          ## 1. Incident Summary
          Briefly describe the affected endpoint and investigation window.

          ## 2. Metrics
          Include total requests, failed requests, server errors, error rate, and average latency.
          Include actual values returned by MCP tools. Never omit available metrics.

          ## 3. Observed Evidence
          List recurring errors, HTTP status codes, timestamps, and patterns from actual logs.

          ## 4. Possible Causes
          Explain hypotheses separately from confirmed observations.

          ## 5. Recommended Debugging Steps
          Give specific, actionable steps based on the evidence.

          ## 6. Conclusion
          State what is known, what remains unknown, and whether the root cause is confirmed.
        `
      },
      {
        role: "user",
        content: question
      }
    ];

    // Store verified incident data returned by the MCP investigation tool.
    let verifiedInvestigation: any = null;
    let verifiedDeploymentCorrelation: any = null;


    // Deterministically retrieve deployment evidence when a version is specified.
    const versionMatch = question.match(/\bv\d+(?:\.\d+)+\b/i);
    const serviceMatch = question.match(/\bfor\s+([a-z0-9][a-z0-9-]*)/i);
    const endpointMatch = question.match(/\/[a-z0-9_-]+/i);

    if (versionMatch && serviceMatch) {
      const correlationResult = await mcpClient.callTool({
        name: "correlate_deployment",
        arguments: {
          service: serviceMatch[1],
          version: versionMatch[0],
          ...(endpointMatch ? { endpoint: endpointMatch[0] } : {}),
          windowMinutes: 60
        }
      });

      const correlationText = Array.isArray(correlationResult.content)
        ? correlationResult.content.find((item: any) => item.type === "text")
        : undefined;

      if (correlationText?.text) {
        try {
          verifiedDeploymentCorrelation = JSON.parse(correlationText.text);
        } catch {
          console.error("Could not parse deployment correlation result.");
        }
      }

      messages.push({
        role: "system",
        content: verifiedDeploymentCorrelation
          ? `Verified deployment correlation data from MCP. Use these exact facts in your report. Do not invent or change them:\n${JSON.stringify(verifiedDeploymentCorrelation)}`
          : `The deployment correlation tool did not return usable evidence. Do not invent deployment metrics.`
      });
    }

    for (let round = 0; round < 6; round++) {
      const completion = await ai.chat.completions.create({
        model,
        messages,
        tools: aiTools,
        temperature: 0.2
      });

      const assistantMessage = completion.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error("Ollama returned an empty response.");
      }

      messages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls || [];

      if (toolCalls.length === 0) {
        const aiReport =
          assistantMessage.content || "No investigation report generated.";

        const reportSections: string[] = [];

        if (verifiedInvestigation?.metrics) {
          const { metrics } = verifiedInvestigation;

          reportSections.push(`
## Verified Incident Metrics

- Endpoint: ${verifiedInvestigation.endpoint ?? "Not specified"}
- Investigation window: ${verifiedInvestigation.timeWindowMinutes ?? "Not specified"} minutes
- Total requests: ${metrics.totalRequests}
- Failed requests: ${metrics.failedRequests}
- Server errors: ${metrics.serverErrors}
- Error rate: ${metrics.errorRate}%
- Average latency: ${metrics.averageLatencyMs} ms

These values come directly from MCP.
`);
        }

        if (verifiedDeploymentCorrelation) {
          const before = verifiedDeploymentCorrelation.beforeDeployment ?? {};
          const after = verifiedDeploymentCorrelation.afterDeployment ?? {};
          const deployment = verifiedDeploymentCorrelation.deployment ?? {};
          const comparison = verifiedDeploymentCorrelation.comparison ?? {};

          reportSections.push(`
## Verified Deployment Correlation

- Service: ${deployment.service ?? "Unknown"}
- Version: ${deployment.version ?? "Unknown"}
- Endpoint: ${verifiedDeploymentCorrelation.endpoint ?? "Unknown"}

| Metric | Before | After |
|---|---:|---:|
| Requests | ${before.totalRequests ?? 0} | ${after.totalRequests ?? 0} |
| Failed requests | ${before.failedRequests ?? 0} | ${after.failedRequests ?? 0} |
| Server errors | ${before.serverErrors ?? 0} | ${after.serverErrors ?? 0} |
| Error rate | ${before.errorRate ?? 0}% | ${after.errorRate ?? 0}% |
| Average latency | ${before.averageLatencyMs ?? 0} ms | ${after.averageLatencyMs ?? 0} ms |

- Error-rate change: ${comparison.errorRateChangePercentagePoints ?? 0} percentage points
- Latency change: ${comparison.averageLatencyChangeMs ?? 0} ms

${verifiedDeploymentCorrelation.conclusion ?? "Correlation does not prove causation."}
`);
        }

        return [...reportSections, aiReport].filter(Boolean).join("\n\n");
      }

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;

        const args = JSON.parse(toolCall.function.arguments || "{}");

        const result = await mcpClient.callTool({
          name: toolCall.function.name,
          arguments: args
        });

        // Preserve the real investigation result for the final report.
        if (
          toolCall.function.name === "investigate_incident" &&
          Array.isArray(result.content)
        ) {
          const textResult = result.content.find(
            (item: any) => item.type === "text"
          );

          if (textResult?.text) {
            try {
              verifiedInvestigation = JSON.parse(textResult.text);
            } catch {
              console.error("Could not parse MCP investigation result.");
            }
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    return "Investigation stopped after reaching the tool-call limit.";
  } finally {
    await mcpClient.close();
  }
}
