import User from "../models/User.js";
import Note from "../models/Note.js";
import Post from "../models/Post.js";
import {
  userInput,
  pagination,
  pageResult,
  fail,
} from "../middleware/validation.js";

export async function listUsers(req, res) {
  const pageOptions = pagination(req);
  const [results, total] = await Promise.all([
    User.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip(pageOptions.skip)
      .limit(pageOptions.limit),
    User.countDocuments(),
  ]);

  res.json({ success: true, data: pageResult(results, total, pageOptions) });
}

export async function getUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) fail(404, "User not found");

  res.json({ success: true, data: user });
}

export async function createUser(req, res) {
  const user = await User.create(userInput(req.body, { admin: true }));

  res.status(201).json({ success: true, data: user });
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) fail(404, "User not found");
  const input = userInput(req.body, { partial: true, admin: true });
  if (user.id === req.user.id && input.role && input.role !== "admin")
    fail(400, "Cannot demote your own admin account");
  Object.assign(user, input);
  await user.save();

  res.json({ success: true, data: user });
}

export async function deleteUser(req, res) {
  if (req.params.id.toLowerCase() === req.user.id)
    fail(400, "Cannot delete your own admin account");
  // A transaction keeps deletion of the account and its content atomic.
  await User.db.transaction(async (session) => {
    const user = await User.findByIdAndDelete(req.params.id, { session });
    if (!user) fail(404, "User not found");
    await Note.deleteMany({ userId: user._id }, { session });
    await Post.deleteMany({ userId: user._id }, { session });
  });

  res.json({ success: true, data: { message: "User and content deleted" } });
}

export async function groupInterests(req, res) {
  const pageOptions = pagination(req);
  const [interestGroups] = await User.aggregate([
    { $project: { name: 1, interests: 1 } },
    { $unwind: "$interests" },
    { $match: { interests: { $type: "string", $regex: /\S/ } } },
    {
      $group: {
        _id: "$interests",
        users: { $addToSet: { _id: "$_id", name: "$name" } },
      },
    },
    {
      $project: {
        _id: 0,
        interest: "$_id",
        users: { $sortArray: { input: "$users", sortBy: { name: 1, _id: 1 } } },
      },
    },
    { $sort: { interest: 1 } },
    {
      $facet: {
        results: [{ $skip: pageOptions.skip }, { $limit: pageOptions.limit }],
        count: [{ $count: "total" }],
      },
    },
  ]);

  res.json({
    success: true,
    data: pageResult(interestGroups.results, interestGroups.count[0]?.total || 0, pageOptions),
  });
}
