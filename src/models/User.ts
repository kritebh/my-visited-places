import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    passwordHash: { type: String },
    isPublic: { type: Boolean, default: false },
    publicSlug: { type: String, unique: true, sparse: true },
    shareReviews: { type: Boolean, default: false },
    // Bumped on every change to this user's visits; part of the read-cache key
    dataVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Schema.Types.ObjectId };

export const User: Model<InferSchemaType<typeof UserSchema>> = models.User ?? model("User", UserSchema);
