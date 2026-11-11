import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { userInput } from "../src/middleware/validation.js";
import User from "../src/models/User.js";
import Note from "../src/models/Note.js";
import Post from "../src/models/Post.js";


const accounts = [
  { name: "Demo Admin", email: "admin@example.com", role: "admin", interests: ["reading", "travel"] },
  { name: "Maya Khan", email: "maya@example.com", role: "user", interests: ["reading", "photography"] },
  { name: "Sam Wilson", email: "sam@example.com", role: "user", interests: ["travel", "cooking"] },
];

try {
  if (process.env.NODE_ENV === "production") throw new Error("Seed data is for development only");
  const inputs = accounts.map((account) => userInput(
    { ...account, password: process.env.SEED_PASSWORD },
    { admin: true },
  ));
  await connectDB();
  for (const model of [User, Note, Post]) await model.createIndexes();

  for (const input of inputs) {
    // Leave existing accounts and their content untouched when running again.
    if (await User.exists({ email: input.email })) {
      console.log(`Skipped existing account: ${input.email}`);
      continue;
    }
    await mongoose.connection.transaction(async (session) => {
      const [user] = await User.create([input], { session });
      await Note.create([
        { userId: user._id, title: "Weekend plans", content: "Visit the bookshop, meet a friend for lunch, and take a walk by the river." },
        { userId: user._id, title: "Things to try", content: "Try a new recipe, finish the book on my desk, and organize last month's photos." },
      ], { session, ordered: true });
      await Post.create([
        { userId: user._id, title: `Hello from ${user.name}`, content: `I enjoy ${user.interests.join(" and ")}. Looking forward to sharing ideas here.` },
      ], { session });
    });
    console.log(`Created ${input.role}: ${input.email}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
