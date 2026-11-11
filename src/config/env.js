import "dotenv/config";


export function validateEnv() {
  for (const key of ["MONGODB_URI", "JWT_SECRET", "FRONTEND_ORIGIN"]) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }
  if (
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.startsWith("replace-")
  ) {
    throw new Error(
      "Set JWT_SECRET to a random secret of at least 32 characters",
    );
  }
}
