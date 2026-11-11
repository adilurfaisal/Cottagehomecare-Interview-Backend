import { validateEnv } from "./config/env.js";
import { connectDB } from "./config/db.js";
import app from "./app.js";


try {
  validateEnv();
  await connectDB();
  const server = app.listen(process.env.PORT || 5000, () =>
    console.log("API listening"),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      server.close(async () => {
        await (await import("mongoose")).default.disconnect();
        process.exit(0);
      });
    });
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}
