import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import Note from "../src/models/Note.js";
import Post from "../src/models/Post.js";

try {
  await connectDB();
  for (const model of [User, Note, Post]) {
    await model.createIndexes();
    console.log(`${model.modelName}: indexes created`);
  }
} finally {
  await mongoose.disconnect();
}
