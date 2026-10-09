import { Schema, model, type InferSchemaType } from "mongoose";

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

const taskSchema = new Schema(
  {
    // Ownership: set from the verified token, never from the request body.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    // When the task is scheduled to happen (the assignment's "date-time").
    startAt: { type: Date, required: true },
    // Optional hard deadline; invariant deadline >= startAt is enforced in validation.
    deadline: { type: Date, default: null },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    tags: { type: [String], default: [] },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
taskSchema.index({ userId: 1, completed: 1, deadline: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema>;
export const Task = model("Task", taskSchema);
