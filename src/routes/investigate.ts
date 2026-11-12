import { Router } from "express";
import { z } from "zod";
import { investigateWithAI } from "../ai/agent.js";

const router = Router();

const requestSchema = z.object({
  question: z.string().min(5).max(2000)
});

router.post("/", async (req, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Please provide a valid question."
      });
    }

    const report = await investigateWithAI(parsed.data.question);

    return res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    console.error("AI investigation failed:", error);

    return res.status(500).json({
      success: false,
      error: "Incident investigation failed."
    });
  }
});

export default router;
