import { Router, Request, Response } from "express";
import Deployment from "../models/Deployment.js";

const router = Router();

// Record a new deployment.
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      service,
      version,
      environment,
      description,
      commitSha,
      deployedAt
    } = req.body;

    if (!service || !version) {
      return res.status(400).json({
        success: false,
        message: "Service and version are required."
      });
    }

    const deployment = await Deployment.create({
      service,
      version,
      environment: environment || "development",
      description: description || "",
      commitSha,
      deployedAt: deployedAt ? new Date(deployedAt) : new Date()
    });

    return res.status(201).json({
      success: true,
      deployment
    });
  } catch (error) {
    console.error("Deployment creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record deployment."
    });
  }
});

// Retrieve deployment history.
router.get("/", async (req: Request, res: Response) => {
  try {
    const { service, environment } = req.query;

    const filter: Record<string, unknown> = {};

    if (typeof service === "string") {
      filter.service = service;
    }

    if (typeof environment === "string") {
      filter.environment = environment;
    }

    const deployments = await Deployment.find(filter)
      .sort({ deployedAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      total: deployments.length,
      deployments
    });
  } catch (error) {
    console.error("Deployment history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch deployments."
    });
  }
});

export default router;
