import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Post.js";
import {
  noteInput,
  pagination,
  pageResult,
  fail,
} from "../middleware/validation.js";

export async function createPost(req, res) {
  const post = await Post.create({
    ...noteInput(req.body),
    userId: req.user._id,
  });

  res.status(201).json({ success: true, data: post });
}

export async function listPosts(req, res) {
  const pageOptions = pagination(req);
  const [results, total] = await Promise.all([
    Post.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip(pageOptions.skip)
      .limit(pageOptions.limit),
    Post.countDocuments(),
  ]);

  res.json({ success: true, data: pageResult(results, total, pageOptions) });
}

export function userPostsPipeline(userId, pageOptions) {
  return [
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    { $project: { name: 1, createdAt: 1 } },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "userId",
        pipeline: [
          { $sort: { createdAt: -1, _id: -1 } },
          {
            $facet: {
              results: [{ $skip: pageOptions.skip }, { $limit: pageOptions.limit }],
              count: [{ $count: "total" }],
            },
          },
        ],
        as: "postData",
      },
    },
  ];
}

export async function userPosts(req, res) {
  const pageOptions = pagination(req);
  const [user] = await User.aggregate(
    userPostsPipeline(req.params.userId, pageOptions),
  );
  if (!user) fail(404, "User not found");
  const postPage = user.postData[0];
  delete user.postData;

  res.json({
    success: true,
    data: {
      user,
      ...pageResult(postPage?.results || [], postPage?.count[0]?.total || 0, pageOptions),
    },
  });
}
