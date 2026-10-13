import "server-only";
import mongoose from "mongoose";

const globalForMongoose = globalThis as unknown as { mongoose?: Promise<typeof mongoose> };

/** Reuses one connection across hot reloads and route invocations. */
export function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  globalForMongoose.mongoose ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }).catch((err) => {
    globalForMongoose.mongoose = undefined;
    throw err;
  });
  return globalForMongoose.mongoose;
}
