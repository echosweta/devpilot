import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import ApiLog from "../models/ApiLog.js";

const router = Router();

router.post("/traffic", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "Traffic simulator is disabled in production"
    });
  }

  try {
    const scenario = req.body.scenario || "normal";
    const count = Math.min(100, Math.max(1, Number(req.body.count) || 20));

    // Optional timestamp anchor for testing historical incidents.
    const timestampAnchor = req.body.timestamp
      ? new Date(req.body.timestamp)
      : null;

    if (timestampAnchor && Number.isNaN(timestampAnchor.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid timestamp. Provide a valid ISO date."
      });
    }

    const scenarios = ["normal", "degradation", "database-timeout"];

    if (!scenarios.includes(scenario)) {
      return res.status(400).json({
        success: false,
        message: "Invalid scenario",
        allowedScenarios: scenarios
      });
    }

    const logs = Array.from({ length: count }, (_, i) => {
      let statusCode = 200;
      let latencyMs = Math.floor(Math.random() * 100) + 20;
      let message = "Request successful";

      if (scenario === "normal" && i % 10 === 0) {
        statusCode = 400;
        message = "Invalid request";
      }

      if (scenario === "degradation") {
        statusCode = i % 3 === 0 ? 500 : 200;
        latencyMs = Math.floor(Math.random() * 3000) + 1000;
        message = statusCode === 500
          ? "Service temporarily unavailable"
          : "Slow response";
      }

      if (scenario === "database-timeout") {
        statusCode = i % 2 === 0 ? 500 : 200;
        latencyMs = Math.floor(Math.random() * 4000) + 2000;
        message = statusCode === 500
          ? "Database connection timeout"
          : "Slow database response";
      }

      return {
        service: "payment-service",
        endpoint: "/payments",
        method: "POST",
        statusCode,
        latencyMs,
        severity: statusCode >= 500 ? "error" :
          statusCode >= 400 ? "warning" : "info",
        message,
        requestId: randomUUID(),
        timestamp: timestampAnchor
          ? new Date(timestampAnchor.getTime() + i * 1000)
          : new Date(Date.now() - (count - i) * 1000)
      };
    });

    await ApiLog.insertMany(logs);

    res.status(201).json({
      success: true,
      scenario,
      generated: logs.length,
      message: "Demo traffic generated successfully"
    });
  } catch (error) {
    console.error("Traffic simulator error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate demo traffic"
    });
  }
});

export default router;
