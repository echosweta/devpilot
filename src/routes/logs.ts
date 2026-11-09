import { Router, Request, Response } from "express";
import ApiLog from "../models/ApiLog.js";

const router = Router();

// GET /api/logs
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const filter: Record<string, unknown> = {};

    if (req.query.endpoint) {
      filter.endpoint = String(req.query.endpoint);
    }

    if (req.query.severity) {
      filter.severity = String(req.query.severity);
    }

    const total = await ApiLog.countDocuments(filter);

    const logs = await ApiLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      total,
      page,
      limit,
      logs
    });
  } catch (error) {
    console.error("Logs API error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch logs"
    });
  }
});

export default router;
