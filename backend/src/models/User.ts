import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    // Stored lowercase+trimmed; the unique index is the real duplicate guard (race-safe).
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // SHA-256 of the current refresh token's jti; rotating it revokes older refresh tokens.
    refreshJti: { type: String, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
