import mongoose from "mongoose";

export function connectDB() {
  return mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
}
