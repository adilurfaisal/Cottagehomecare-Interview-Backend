import express from "express";
import cors from "cors";
import { errors } from "./middleware/errors.js";
import {
  authRouter,
  usersRouter,
  interestsRouter,
  notesRouter,
  adminNotesRouter,
  postsRouter,
} from "./routes/index.js";

const app = express();
app.disable("x-powered-by");
// Render has one reverse proxy in front of the service.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(
  cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }),
);
app.use(express.json({ limit: "128kb" }));
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "no-store");
  next();
});
app.get("/api/health", (_req, res) =>

  res.json({ success: true, data: { status: "ok" } }),
);
app.use("/api/auth", authRouter);
app.use("/api/admin/users", usersRouter);
app.use("/api/interests", interestsRouter);
app.use("/api/notes", notesRouter);
app.use("/api/admin/notes", adminNotesRouter);
app.use("/api/posts", postsRouter);
app.use((_req, res) =>

  res.status(404).json({ success: false, message: "Route not found" }),
);
app.use(errors);
export default app;
