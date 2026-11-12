import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ApiLog from "../models/ApiLog.js";
import Deployment from "../models/Deployment.js";

dotenv.config();

// Connect to the existing DevPilot MongoDB database.
await mongoose.connect(process.env.MONGO_URI!);

// Create the MCP server.
const server = new McpServer({
  name: "devpilot",
  version: "1.0.0"
});

// Register the search_logs tool.
server.registerTool(
  "search_logs",
  {
    description: "Search API logs by endpoint and severity.",
    inputSchema: {
      endpoint: z.string().optional(),
      severity: z.enum(["info", "warning", "error"]).optional(),
      limit: z.number().int().min(1).max(100).optional()
    }
  },
  async ({ endpoint, severity, limit }) => {
    try {
      const filter: Record<string, unknown> = {};

      if (endpoint) filter.endpoint = endpoint;
      if (severity) filter.severity = severity;

      const logs = await ApiLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(limit ?? 10)
        .lean();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(logs, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to search logs: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);


// Register the get_api_metrics tool.

server.registerTool(
  "get_api_metrics",
  {
    description:
      "Get API metrics filtered by endpoint and optional time window.",
    inputSchema: {
      endpoint: z.string().optional(),
      minutes: z.number().int().min(1).max(10080).optional()
    }
  },
  async ({ endpoint, minutes }) => {
    try {
      const filter: Record<string, unknown> = {};

      if (endpoint) filter.endpoint = endpoint;

      if (minutes) {
        filter.timestamp = {
          $gte: new Date(Date.now() - minutes * 60 * 1000)
        };
      }

      const [stats] = await ApiLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            failedRequests: {
              $sum: {
                $cond: [{ $gte: ["$statusCode", 400] }, 1, 0]
              }
            },
            serverErrors: {
              $sum: {
                $cond: [{ $gte: ["$statusCode", 500] }, 1, 0]
              }
            },
            averageLatencyMs: { $avg: "$latencyMs" }
          }
        }
      ]);

      const totalRequests = stats?.totalRequests ?? 0;
      const failedRequests = stats?.failedRequests ?? 0;

      const metrics = {
        endpoint: endpoint ?? "all",
        timeWindowMinutes: minutes ?? "all",
        totalRequests,
        failedRequests,
        serverErrors: stats?.serverErrors ?? 0,
        errorRate: totalRequests
          ? Number(((failedRequests / totalRequests) * 100).toFixed(2))
          : 0,
        averageLatencyMs: Number(
          (stats?.averageLatencyMs ?? 0).toFixed(2)
        )
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(metrics, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to get API metrics: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);



// Register the check_api_health tool.
server.registerTool(
  "check_api_health",
  {
    description: "Check DevPilot database connectivity and health.",
    inputSchema: {}
  },
  async () => {
    try {
      const db = mongoose.connection.db;

      if (!db || mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB is not connected");
      }

      // Ping MongoDB to verify that it responds.
      await db.admin().ping();

      const totalLogs = await ApiLog.countDocuments();

      const health = {
        status: "healthy",
        database: "connected",
        databasePing: "successful",
        totalLogs
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(health, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "unhealthy",
              database: "unavailable",
              error: String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
);


// Register the investigate_incident tool.
server.registerTool(
  "investigate_incident",
  {
    description: "Investigate an API incident using database health, metrics, and recent error logs.",
    inputSchema: {
      endpoint: z.string().optional(),
      minutes: z.number().int().min(1).max(10080).optional()
    }
  },
  async ({ endpoint, minutes }) => {
    try {
      const windowMinutes = minutes ?? 60;
      const since = new Date(Date.now() - windowMinutes * 60 * 1000);

      const db = mongoose.connection.db;
      if (!db || mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB is not connected");
      }

      await db.admin().ping();

      const filter: Record<string, unknown> = {
        timestamp: { $gte: since }
      };

      if (endpoint) {
        filter.endpoint = endpoint;
      }

      const [stats] = await ApiLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            failedRequests: {
              $sum: {
                $cond: [{ $gte: ["$statusCode", 400] }, 1, 0]
              }
            },
            serverErrors: {
              $sum: {
                $cond: [{ $gte: ["$statusCode", 500] }, 1, 0]
              }
            },
            averageLatencyMs: { $avg: "$latencyMs" }
          }
        }
      ]);

      const recentErrors = await ApiLog.find({
        ...filter,
        statusCode: { $gte: 500 }
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .select("endpoint statusCode latencyMs message timestamp")
        .lean();

      const totalRequests = stats?.totalRequests ?? 0;
      const failedRequests = stats?.failedRequests ?? 0;
      const serverErrors = stats?.serverErrors ?? 0;

      const messageCounts: Record<string, number> = {};

      for (const log of recentErrors) {
        const message = log.message || "Unknown error";
        messageCounts[message] = (messageCounts[message] ?? 0) + 1;
      }

      const recurringErrors = Object.entries(messageCounts)
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count);

      const report = {
        endpoint: endpoint ?? "all endpoints",
        timeWindowMinutes: windowMinutes,
        database: "healthy",
        metrics: {
          totalRequests,
          failedRequests,
          serverErrors,
          errorRate: totalRequests
            ? Number(((failedRequests / totalRequests) * 100).toFixed(2))
            : 0,
          averageLatencyMs: Number(
            (stats?.averageLatencyMs ?? 0).toFixed(2)
          )
        },
        recentServerErrors: recentErrors,
        recurringErrors,
        observations: [
          ...(serverErrors > 0
            ? ["Server errors were recorded during the investigation window."]
            : []),
          ...(recurringErrors.length > 0
            ? ["Repeated error messages were found in recent server errors."]
            : []),
          ...(totalRequests === 0
            ? ["No requests were found in the selected time window."]
            : []),
          ...(serverErrors === 0 && totalRequests > 0
            ? ["No HTTP 5xx errors were found in the selected time window."]
            : [])
        ],
        conclusion: "Evidence summary only. Root cause is not confirmed; investigate database and deployment evidence before assigning causality."
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(report, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Incident investigation failed: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);


// Compare API metrics before and after a deployment.
server.registerTool(
  "correlate_deployment",
  {
    description:
      "Find a deployment by deploymentId OR by service and version, then compare API error rates and latency before and after it. Use service and version when the user mentions a deployment version. Reports correlation, not proven causation.",
    inputSchema: {
      deploymentId: z.string().optional(),
      service: z.string().optional(),
      version: z.string().optional(),
      endpoint: z.string().optional(),
      windowMinutes: z.number().int().min(1).max(10080).optional()
    }
  },
  async ({ deploymentId, service, version, endpoint, windowMinutes }) => {
    try {
      let deployment;

      if (deploymentId) {
        if (!mongoose.Types.ObjectId.isValid(deploymentId)) {
          throw new Error("Invalid deployment ID.");
        }

        deployment = await Deployment.findById(deploymentId);
      } else if (service && version) {
        deployment = await Deployment.findOne({ service, version })
          .sort({ deployedAt: -1 });
      } else {
        throw new Error(
          "Provide deploymentId or both service and version."
        );
      }

      if (!deployment) {
        throw new Error("Deployment not found.");
      }

      const window = windowMinutes ?? 60;
      const deployedAt = deployment.deployedAt;
      const windowMs = window * 60 * 1000;

      const baseFilter: Record<string, unknown> = {
        service: deployment.service
      };

      if (endpoint) {
        baseFilter.endpoint = endpoint;
      }

      const getMetrics = async (start: Date, end: Date) => {
        const result = await ApiLog.aggregate([
          {
            $match: {
              ...baseFilter,
              timestamp: { $gte: start, $lt: end }
            }
          },
          {
            $group: {
              _id: null,
              totalRequests: { $sum: 1 },
              failedRequests: {
                $sum: {
                  $cond: [{ $gte: ["$statusCode", 400] }, 1, 0]
                }
              },
              serverErrors: {
                $sum: {
                  $cond: [{ $gte: ["$statusCode", 500] }, 1, 0]
                }
              },
              averageLatencyMs: { $avg: "$latencyMs" }
            }
          }
        ]);

        const metrics = result[0] ?? {
          totalRequests: 0,
          failedRequests: 0,
          serverErrors: 0,
          averageLatencyMs: 0
        };

        return {
          totalRequests: metrics.totalRequests,
          failedRequests: metrics.failedRequests,
          serverErrors: metrics.serverErrors,
          averageLatencyMs: Number(
            (metrics.averageLatencyMs ?? 0).toFixed(2)
          ),
          errorRate: metrics.totalRequests
            ? Number(
                ((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2)
              )
            : 0
        };
      };

      const before = await getMetrics(
        new Date(deployedAt.getTime() - windowMs),
        deployedAt
      );

      const after = await getMetrics(
        deployedAt,
        new Date(deployedAt.getTime() + windowMs)
      );

      const errorRateChange = Number(
        (after.errorRate - before.errorRate).toFixed(2)
      );

      const latencyChange = Number(
        (after.averageLatencyMs - before.averageLatencyMs).toFixed(2)
      );

      const report = {
        deployment: {
          id: deployment._id,
          service: deployment.service,
          version: deployment.version,
          environment: deployment.environment,
          deployedAt,
          description: deployment.description
        },
        endpoint: endpoint ?? "All endpoints for this service",
        windowMinutes: window,
        beforeDeployment: before,
        afterDeployment: after,
        comparison: {
          errorRateChangePercentagePoints: errorRateChange,
          averageLatencyChangeMs: latencyChange,
          observation:
            before.totalRequests === 0 || after.totalRequests === 0
              ? "Insufficient traffic in one of the comparison windows."
              : errorRateChange > 0
                ? "Error rate increased after deployment. This is a possible deployment-related regression, not proof of causation."
                : errorRateChange < 0
                  ? "Error rate decreased after deployment."
                  : "Error rate remained unchanged."
        },
        conclusion:
          "This comparison shows temporal correlation only. Investigate logs, infrastructure, database health, and other changes before confirming root cause."
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(report, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Deployment correlation failed: ${String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Start the server using standard input/output transport.
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("DevPilot MCP server started");
