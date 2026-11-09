import { Router, Request, Response } from "express";
import ApiLog from "../models/ApiLog.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const [stats] = await ApiLog.aggregate([
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          failedRequests: {
            $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] }
          },
          serverErrors: {
            $sum: { $cond: [{ $gte: ["$statusCode", 500] }, 1, 0] }
          },
          averageLatencyMs: { $avg: "$latencyMs" }
        }
      }
    ]);

    const totalRequests = stats?.totalRequests ?? 0;
    const failedRequests = stats?.failedRequests ?? 0;

    res.json({
      success: true,
      metrics: {
        totalRequests,
        failedRequests,
        serverErrors: stats?.serverErrors ?? 0,
        errorRate: totalRequests
          ? Number(((failedRequests / totalRequests) * 100).toFixed(2))
          : 0,
        averageLatencyMs: Number((stats?.averageLatencyMs ?? 0).toFixed(2))
      }
    });
  } catch (error) {
    console.error("Metrics API error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch metrics"
    });
  }
});

export default router;
