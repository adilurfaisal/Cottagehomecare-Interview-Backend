import Note from "../models/Note.js";
import {
  noteInput,
  pagination,
  pageResult,
  fail,
} from "../middleware/validation.js";

export async function listNotes(req, res) {
  const pageOptions = pagination(req);
  const isAdminView = req.baseUrl === "/api/admin/notes";
  const filter = {};
  if (!isAdminView) {
    filter.userId = req.user._id;
  } else if (req.params.userId) {
    filter.userId = req.params.userId;
  }
  const [results, total] = await Promise.all([
    Note.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(pageOptions.skip)
      .limit(pageOptions.limit),
    Note.countDocuments(filter),
  ]);

  res.json({ success: true, data: pageResult(results, total, pageOptions) });
}

export async function createNote(req, res) {
  const note = await Note.create({
    ...noteInput(req.body),
    userId: req.user._id,
  });

  res.status(201).json({ success: true, data: note });
}

export async function getNote(req, res) {
  const filter = { _id: req.params.id };
  if (req.user.role !== "admin") filter.userId = req.user._id;
  const note = await Note.findOne(filter);
  if (!note) fail(404, "Note not found");

  res.json({ success: true, data: note });
}

export async function updateNote(req, res) {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    noteInput(req.body),
    { new: true, runValidators: true },
  );
  if (!note) fail(404, "Note not found");

  res.json({ success: true, data: note });
}

export async function deleteNote(req, res) {
  const note = await Note.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!note) fail(404, "Note not found");

  res.json({ success: true, data: { message: "Note deleted" } });
}
