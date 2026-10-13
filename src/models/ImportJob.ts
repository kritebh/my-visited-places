import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const ImportJobSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: String,
    counts: { type: Map, of: Number },
    received: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    merged: { type: Number, default: 0 },
    ignoredDeleted: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ImportJob: Model<InferSchemaType<typeof ImportJobSchema>> =
  models.ImportJob ?? model("ImportJob", ImportJobSchema);
