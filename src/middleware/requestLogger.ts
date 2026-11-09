import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import ApiLog from "../models/ApiLog.js";

const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const requestId = randomUUID();

  res.on("finish", async () => {
    const latencyMs = Date.now() - startTime;

    const statusCode = res.statusCode;

    const severity =
      statusCode >= 500 ? "error" :
      statusCode >= 400 ? "warning" : "info";

    try {
      await ApiLog.create({
        service: "DevPilot API",
        endpoint: req.path,
        method: req.method,
        statusCode,
        latencyMs,
        severity,
        message: statusCode >= 400 ? "Request failed" : "Request successful",
        requestId,
        timestamp: new Date()
      });

      console.log(`Logged: ${req.method} ${req.path} [${statusCode}]`);
    } catch (error) {
      console.error("Failed to save API log:", error);
    }
  });

  next();
};

export default requestLogger;
