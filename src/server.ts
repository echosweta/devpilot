import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import connectDB from "./config/database.js";
import requestLogger from "./middleware/requestLogger.js";
import logsRouter from "./routes/logs.js";
import metricsRouter from "./routes/metrics.js";
import simulatorRouter from "./routes/simulator.js";
import investigateRouter from "./routes/investigate.js";
import deploymentsRouter from "./routes/deployments.js";

dotenv.config();

const app = express();

// Security-related HTTP headers
app.use(helmet());

// Parse incoming JSON request bodies
app.use(express.json());

// Automatically log every API request
app.use(requestLogger);

app.use("/api/logs", logsRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/simulate", simulatorRouter);
app.use("/api/investigate", investigateRouter);
app.use("/api/deployments", deploymentsRouter);

// Health check API
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "DevPilot API",
    timestamp: new Date().toISOString()
  });
});

// Start server only after MongoDB connects
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`DevPilot server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
