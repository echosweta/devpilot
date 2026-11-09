import mongoose, { Schema, Document } from "mongoose";

export interface IApiLog extends Document {
  service: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  severity: string;
  message: string;
  requestId: string;
  timestamp: Date;
}

const apiLogSchema = new Schema<IApiLog>({
  service: {
    type: String,
    required: true,
    default: "DevPilot API"
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  latencyMs: {
    type: Number,
    required: true
  },
  severity: {
    type: String,
    enum: ["info", "warning", "error"],
    required: true
  },
  message: {
    type: String,
    default: ""
  },
  requestId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IApiLog>("ApiLog", apiLogSchema);
