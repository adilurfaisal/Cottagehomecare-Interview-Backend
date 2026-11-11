import bcrypt from "bcrypt";
import User from "../models/User.js";
import { tokenFor } from "../middleware/auth.js";
import { userInput, text, fail } from "../middleware/validation.js";


export async function register(req, res) {
  const user = await User.create({ ...userInput(req.body), role: "user" });
  res
    .status(201)
    .json({ success: true, data: { user, token: tokenFor(user) } });
}

export async function login(req, res) {
  const email = text(req.body?.email, "Email", 254).toLowerCase();
  const password = req.body?.password;
  if (typeof password !== "string" || Buffer.byteLength(password) > 72)
    fail(400, "Invalid password");
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password)))
    fail(401, "Invalid email or password");

  res.json({ success: true, data: { user, token: tokenFor(user) } });
}

export function profile(req, res) {
  res.json({ success: true, data: req.user });
}

export async function updateProfile(req, res) {
  // Profile changes deliberately exclude role and password.
  const { name, email, interests } = userInput(
    {
      name: req.body?.name,
      email: req.body?.email,
      interests: req.body?.interests,
    },
    { partial: true },
  );
  for (const [key, value] of Object.entries({ name, email, interests }))
    if (value !== undefined) req.user[key] = value;
  await req.user.save();

  res.json({ success: true, data: req.user });
}
