import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { fail } from "./validation.js";


export function tokenFor(user) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: "1h",
    algorithm: "HS256",
    issuer: "secure-notes",
    audience: "secure-notes-web",
  });
}

export async function authenticate(req, _res, next) {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader?.startsWith("Bearer ")) fail(401, "Authentication required");
  let payload;

  try {
    payload = jwt.verify(authorizationHeader.slice(7), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "secure-notes",
      audience: "secure-notes-web",
    });
  } catch {
    fail(401, "Invalid or expired token");
  }
  if (typeof payload.sub !== "string" || !/^[a-f\d]{24}$/i.test(payload.sub))
    fail(401, "Invalid token");
  req.user = await User.findById(payload.sub);
  if (!req.user) fail(401, "Account no longer exists");
  next();
}

export function adminOnly(req, _res, next) {
  if (req.user.role !== "admin") fail(403, "Administrator access required");
  next();
}
