import mongoose, { Schema, Document } from "mongoose";

export interface IDeployment extends Document {
  service: string;
  version: string;
  environment: "development" | "staging" | "production";
  description: string;
  commitSha?: string;
  deployedAt: Date;
  createdAt: Date;
}

const deploymentSchema = new Schema<IDeployment>(
  {
    service: {
      type: String,
      required: true,
      index: true
    },
    version: {
      type: String,
      required: true
    },
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      default: "development",
      required: true
    },
    description: {
      type: String,
      default: ""
    },
    commitSha: {
      type: String
    },
    deployedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

deploymentSchema.index({ service: 1, deployedAt: -1 });

export default mongoose.model<IDeployment>(
  "Deployment",
  deploymentSchema
);
