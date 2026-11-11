import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import Note from "../src/models/Note.js";
import Post from "../src/models/Post.js";
import { userPostsPipeline } from "../src/controllers/posts.js";

try {
  await connectDB();
  const user = await User.findOne();
  if (!user) throw new Error("Create a user and some notes/posts first");
  for (const [label, query] of [
    ["Email equality", User.find({ email: user.email })],
    [
      "Users newest first",
      User.find().sort({ createdAt: -1, _id: -1 }).limit(10),
    ],
    [
      "Owner notes",
      Note.find({ userId: user._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(10),
    ],
    ["All notes", Note.find().sort({ createdAt: -1, _id: -1 }).limit(10)],
    ["Public posts", Post.find().sort({ createdAt: -1, _id: -1 }).limit(10)],
  ])
    console.log(
      label,
      JSON.stringify(await query.explain("executionStats"), null, 2),
    );
  console.log(
    "User posts lookup",
    JSON.stringify(
      await User.aggregate(
        userPostsPipeline(user._id, { skip: 0, limit: 10 }),
      ).explain("executionStats"),
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
