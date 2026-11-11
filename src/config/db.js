import mongoose from "mongoose";

let connectionPromise;

export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10000,
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  return connectionPromise;
}

mongoose.connection.on("disconnected", () => {
  connectionPromise = undefined;
});
