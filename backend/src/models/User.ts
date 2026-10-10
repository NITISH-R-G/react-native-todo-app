import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    // Stored lowercase+trimmed; the unique index is the real duplicate guard (race-safe).
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // One entry per signed-in device/session: SHA-256 of that session's current refresh-token jti.
    // Rotation replaces the matching entry atomically; at most MAX_SESSIONS are kept (oldest evicted).
    refreshTokens: {
      type: [{ hash: { type: String, required: true }, createdAt: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
  },
  { timestamps: true },
);

/** Maximum simultaneously signed-in sessions per user; signing in beyond this signs out the oldest. */
export const MAX_SESSIONS = 5;

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
