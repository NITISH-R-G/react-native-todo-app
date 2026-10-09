import mongoose from "mongoose";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { Task } from "./models/Task.js";
import { User } from "./models/User.js";

const cfg = loadConfig();
await mongoose.connect(cfg.mongoUri);
await Promise.all([User.init(), Task.init()]); // ensure indexes exist before serving
createApp(cfg).listen(cfg.port, () => console.log(`API listening on :${cfg.port}`));
