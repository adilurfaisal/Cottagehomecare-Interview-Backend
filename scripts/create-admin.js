import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import { userInput } from "../src/middleware/validation.js";


try {
  const input = userInput({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  await connectDB();
  await User.createIndexes();
  if (await User.exists({ role: "admin" }))
    throw new Error("An admin already exists; use the authenticated admin API");
  await User.create({ ...input, role: "admin" });
  console.log("Initial admin created");
} catch (error) {
  console.error(
    error.code === 11000
      ? "Email already exists; no account was changed"
      : error.message,
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
