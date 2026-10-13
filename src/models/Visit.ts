import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { SOURCES } from "@/lib/types";

const VisitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    source: { type: String, enum: SOURCES, required: true },
    name: String,
    address: String,
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    visitedAt: Date,
    endAt: Date,
    countryCode: String,
    countryName: String,
    stateCode: String,
    stateName: String,
    rating: Number,
    reviewText: String,
    mapsUrl: String,
    meta: Schema.Types.Mixed,
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true },
);

VisitSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
VisitSchema.index({ userId: 1, visitedAt: -1 });
VisitSchema.index({ userId: 1, source: 1, visitedAt: 1 });
VisitSchema.index({ userId: 1, countryCode: 1, stateCode: 1 });
VisitSchema.index({ location: "2dsphere" });

export type VisitDoc = InferSchemaType<typeof VisitSchema>;

export const Visit: Model<VisitDoc> = models.Visit ?? model("Visit", VisitSchema);
