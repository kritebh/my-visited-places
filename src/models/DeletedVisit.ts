import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Tombstone for an imported visit the user deleted, so importing the same
 * export again doesn't bring it back. Timeline tombstones keep time and place
 * so overlapping exports of the same stay are recognised too.
 */
const DeletedVisitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dedupeKey: { type: String, required: true },
    source: { type: String, required: true },
    location: { type: { type: String, enum: ["Point"], default: "Point" }, coordinates: [Number] },
    visitedAt: Date,
    endAt: Date,
    meta: { placeId: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

DeletedVisitSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
DeletedVisitSchema.index({ userId: 1, source: 1, visitedAt: 1 });

export const DeletedVisit: Model<InferSchemaType<typeof DeletedVisitSchema>> =
  models.DeletedVisit ?? model("DeletedVisit", DeletedVisitSchema);
