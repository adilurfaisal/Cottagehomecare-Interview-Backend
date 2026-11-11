import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate, adminOnly } from "../middleware/auth.js";
import { objectId } from "../middleware/validation.js";
import * as auth from "../controllers/auth.js";
import * as users from "../controllers/users.js";
import * as notes from "../controllers/notes.js";
import * as posts from "../controllers/posts.js";


export const authRouter = Router();
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later.",
  },
});
authRouter.post("/register", authLimit, auth.register);
authRouter.post("/login", authLimit, auth.login);
authRouter.get("/me", authenticate, auth.profile);
authRouter.patch("/me", authenticate, auth.updateProfile);

export const usersRouter = Router();
usersRouter.use(authenticate, adminOnly);
usersRouter.param("id", objectId);
usersRouter.route("/").get(users.listUsers).post(users.createUser);
usersRouter
  .route("/:id")
  .get(users.getUser)
  .patch(users.updateUser)
  .delete(users.deleteUser);

export const interestsRouter = Router();
interestsRouter.get("/", authenticate, users.groupInterests);

export const notesRouter = Router();
notesRouter.use(authenticate);
notesRouter.param("id", objectId);
notesRouter.route("/").get(notes.listNotes).post(notes.createNote);
notesRouter
  .route("/:id")
  .get(notes.getNote)
  .put(notes.updateNote)
  .delete(notes.deleteNote);

export const adminNotesRouter = Router();
adminNotesRouter.use(authenticate, adminOnly);
adminNotesRouter.param("userId", objectId);
adminNotesRouter.get("/", notes.listNotes);
adminNotesRouter.get("/user/:userId", notes.listNotes);

export const postsRouter = Router();
postsRouter.param("userId", objectId);
postsRouter.get("/", posts.listPosts);
postsRouter.get("/user/:userId", posts.userPosts);
postsRouter.post("/", authenticate, posts.createPost);
