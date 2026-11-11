import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import User from "../src/models/User.js";
import Note from "../src/models/Note.js";
import Post from "../src/models/Post.js";
import { userPostsPipeline } from "../src/controllers/posts.js";

process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
const { default: app } = await import("../src/app.js");
let mongo, alice, bob, admin, noteId;
const password = "Test-password-123";
const auth = (token) => ({ Authorization: `Bearer ${token}` });
async function register(name, interests = []) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name,
      email: `${name.toLowerCase()}@example.com`,
      password,
      interests,
      role: "admin",
    })
    .expect(201);
  return response.body.data;
}
before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.24" },
  });
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  await Promise.all([
    User.createIndexes(),
    Note.createIndexes(),
    Post.createIndexes(),
  ]);
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test("registration, login, password hashing and forced user role", async () => {
  alice = await register("Alice", ["coding", "chess", "CODING"]);
  bob = await register("Bob", ["football", "chess"]);
  assert.equal(alice.user.role, "user");
  assert.equal(alice.user.password, undefined);
  assert.deepEqual(alice.user.interests, ["coding", "chess"]);
  const stored = await User.findById(alice.user._id).select("+password");
  assert.notEqual(stored.password, password);
  assert.ok(await bcrypt.compare(password, stored.password));
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "ALICE@example.com", password })
    .expect(200);
  assert.ok(login.body.data.token);
  assert.equal(login.body.data.user.password, undefined);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "alice@example.com", password: "incorrect" })
    .expect(401);
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Duplicate", email: "Alice@example.com", password })
    .expect(409);
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Bad", email: "bad", password: "short" })
    .expect(400);
  const account = await User.create({
    name: "Admin",
    email: "admin@example.com",
    password,
    role: "admin",
  });
  admin = (
    await request(app)
      .post("/api/auth/login")
      .send({ email: account.email, password })
      .expect(200)
  ).body.data;
});
test("profile updates cannot change role or expose password", async () => {
  const response = await request(app)
    .patch("/api/auth/me")
    .set(auth(alice.token))
    .send({ name: "Alice", role: "admin", password: "hacked-password" })
    .expect(200);
  assert.equal(response.body.data.role, "user");
  assert.equal(response.body.data.password, undefined);
  await request(app).get("/api/auth/me").set(auth(alice.token)).expect(200);
});
test("notes CRUD enforces ownership including forged owner fields", async () => {
  const created = await request(app)
    .post("/api/notes")
    .set(auth(alice.token))
    .send({ title: "Private", content: "Secret", userId: bob.user._id })
    .expect(201);
  noteId = created.body.data._id;
  assert.equal(created.body.data.userId, alice.user._id);
  await request(app)
    .get(`/api/notes/${noteId}`)
    .set(auth(alice.token))
    .expect(200);
  await request(app)
    .get(`/api/notes/${noteId}`)
    .set(auth(bob.token))
    .expect(404);
  await request(app)
    .put(`/api/notes/${noteId}`)
    .set(auth(bob.token))
    .send({ title: "Stolen", content: "No" })
    .expect(404);
  await request(app)
    .delete(`/api/notes/${noteId}`)
    .set(auth(bob.token))
    .expect(404);
  await request(app)
    .put(`/api/notes/${noteId}`)
    .set(auth(admin.token))
    .send({ title: "Admin edit", content: "No" })
    .expect(404);
  const updated = await request(app)
    .put(`/api/notes/${noteId}`)
    .set(auth(alice.token))
    .send({ title: "Updated", content: "Still private" })
    .expect(200);
  assert.equal(updated.body.data.title, "Updated");
  const list = await request(app)
    .get(`/api/notes?userId=${alice.user._id}`)
    .set(auth(bob.token))
    .expect(200);
  assert.equal(list.body.data.total, 0);
});
test("admin manages users, views all notes and filters by user", async () => {
  await request(app).get("/api/admin/users").set(auth(alice.token)).expect(403);
  await request(app).get("/api/admin/notes").set(auth(alice.token)).expect(403);
  await request(app)
    .get(`/api/admin/notes/user/${alice.user._id}`)
    .set(auth(bob.token))
    .expect(403);
  const notes = await request(app)
    .get("/api/admin/notes")
    .set(auth(admin.token))
    .expect(200);
  assert.equal(notes.body.data.total, 1);
  const filtered = await request(app)
    .get(`/api/admin/notes/user/${bob.user._id}`)
    .set(auth(admin.token))
    .expect(200);
  assert.equal(filtered.body.data.total, 0);
  const created = await request(app)
    .post("/api/admin/users")
    .set(auth(admin.token))
    .send({ name: "Temp", email: "temp@example.com", password })
    .expect(201);
  const id = created.body.data._id;
  await request(app)
    .get(`/api/admin/users/${id}`)
    .set(auth(admin.token))
    .expect(200);
  await request(app)
    .patch(`/api/admin/users/${id}`)
    .set(auth(admin.token))
    .send({ name: "Changed", password: "new-password-123", role: "admin" })
    .expect(200);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "temp@example.com", password: "new-password-123" })
    .expect(200);
  await request(app)
    .post("/api/notes")
    .set(auth(login.body.data.token))
    .send({ title: "Delete me", content: "Content" })
    .expect(201);
  await request(app)
    .post("/api/posts")
    .set(auth(login.body.data.token))
    .send({ title: "Delete me", content: "Content" })
    .expect(201);
  await request(app)
    .delete(`/api/admin/users/${id}`)
    .set(auth(admin.token))
    .expect(200);
  assert.equal(await Note.countDocuments({ userId: id }), 0);
  assert.equal(await Post.countDocuments({ userId: id }), 0);
  await request(app)
    .get("/api/auth/me")
    .set(auth(login.body.data.token))
    .expect(401);
  await request(app)
    .delete(`/api/admin/users/${admin.user._id}`)
    .set(auth(admin.token))
    .expect(400);
  await request(app)
    .delete(`/api/admin/users/${admin.user._id.toUpperCase()}`)
    .set(auth(admin.token))
    .expect(400);
});
test("pagination validates input and returns sorted pages", async () => {
  await request(app)
    .post("/api/notes")
    .set(auth(alice.token))
    .send({ title: "Second", content: "More" })
    .expect(201);
  const first = await request(app)
    .get("/api/notes?page=1&limit=1")
    .set(auth(alice.token))
    .expect(200);
  const second = await request(app)
    .get("/api/notes?page=2&limit=1")
    .set(auth(alice.token))
    .expect(200);
  assert.equal(first.body.data.total, 2);
  assert.equal(first.body.data.totalPages, 2);
  assert.equal(first.body.data.results[0].title, "Second");
  assert.notEqual(
    first.body.data.results[0]._id,
    second.body.data.results[0]._id,
  );
  for (const query of [
    "page=0",
    "page=-1",
    "limit=101",
    "limit=2.5",
    "page=abc",
    "page=1&page=2",
  ]) {
    await request(app)
      .get(`/api/notes?${query}`)
      .set(auth(alice.token))
      .expect(400);
  }
  const users = await request(app)
    .get("/api/admin/users?limit=1")
    .set(auth(admin.token))
    .expect(200);
  assert.equal(users.body.data.results.length, 1);
  assert.equal(users.body.data.total, 3);
});
test("interests aggregation uses one aggregate and groups correctly", async () => {
  let aggregateCalls = 0;
  const original = User.aggregate;
  User.aggregate = function (...args) {
    aggregateCalls++;
    return original.apply(this, args);
  };
  try {
    const result = await request(app)
      .get("/api/interests?limit=2")
      .set(auth(alice.token))
      .expect(200);
    assert.equal(aggregateCalls, 1);
    assert.equal(result.body.data.total, 3);
    assert.deepEqual(
      result.body.data.results.map((g) => g.interest),
      ["chess", "coding"],
    );
    assert.deepEqual(
      result.body.data.results[0].users.map((u) => u.name),
      ["Alice", "Bob"],
    );
    const second = await request(app)
      .get("/api/interests?page=2&limit=2")
      .set(auth(alice.token))
      .expect(200);
    assert.equal(second.body.data.results[0].interest, "football");
  } finally {
    User.aggregate = original;
  }
});
test("public posts and single lookup aggregation return correct paginated posts", async () => {
  for (const title of ["First", "Second"])
    await request(app)
      .post("/api/posts")
      .set(auth(alice.token))
      .send({ title, content: "Public", userId: bob.user._id })
      .expect(201);
  await request(app)
    .post("/api/posts")
    .set(auth(bob.token))
    .send({ title: "Bob post", content: "Public" })
    .expect(201);
  const publicPosts = await request(app).get("/api/posts?limit=2").expect(200);
  assert.equal(publicPosts.body.data.total, 3);
  assert.equal(publicPosts.body.data.results.length, 2);
  assert.ok(
    userPostsPipeline(alice.user._id, { skip: 0, limit: 1 }).some(
      (stage) => stage.$lookup,
    ),
  );
  let calls = 0;
  const original = User.aggregate;
  User.aggregate = function (pipeline) {
    calls++;
    assert.ok(pipeline.some((stage) => stage.$lookup));
    return original.call(this, pipeline);
  };
  try {
    const result = await request(app)
      .get(`/api/posts/user/${alice.user._id}?limit=1`)
      .expect(200);
    assert.equal(calls, 1);
    assert.equal(result.body.data.user.name, "Alice");
    assert.equal(result.body.data.user.email, undefined);
    assert.equal(result.body.data.user.password, undefined);
    assert.equal(result.body.data.total, 2);
    assert.equal(result.body.data.results[0].title, "Second");
    const page2 = await request(app)
      .get(`/api/posts/user/${alice.user._id}?page=2&limit=1`)
      .expect(200);
    assert.equal(page2.body.data.results[0].title, "First");
    const empty = await request(app)
      .get(`/api/posts/user/${admin.user._id}`)
      .expect(200);
    assert.equal(empty.body.data.total, 0);
    assert.deepEqual(empty.body.data.results, []);
  } finally {
    User.aggregate = original;
  }
});
test("invalid IDs, missing records, malformed requests and unauthorized calls", async () => {
  await request(app).get("/api/notes").expect(401);
  await request(app)
    .post("/api/posts")
    .send({ title: "No", content: "No" })
    .expect(401);
  await request(app).get("/api/notes").set(auth("bad-token")).expect(401);
  await request(app)
    .get("/api/notes/invalid")
    .set(auth(alice.token))
    .expect(400);
  await request(app).get("/api/posts/user/invalid").expect(400);
  await request(app)
    .get(`/api/posts/user/${new mongoose.Types.ObjectId()}`)
    .expect(404);
  await request(app)
    .post("/api/notes")
    .set(auth(alice.token))
    .send({ title: { $gt: "" }, content: "No" })
    .expect(400);
  await request(app)
    .post("/api/auth/login")
    .send({ email: { $ne: null }, password })
    .expect(400);
  await request(app)
    .post("/api/notes")
    .set(auth(alice.token))
    .set("Content-Type", "application/json")
    .send("{broken")
    .expect(400);
  await request(app)
    .delete(`/api/notes/${noteId}`)
    .set(auth(alice.token))
    .expect(200);
  await request(app)
    .get(`/api/notes/${noteId}`)
    .set(auth(alice.token))
    .expect(404);
});
test("index query plans support owner sorting and lookup", async () => {
  const plan = await Note.find({ userId: alice.user._id })
    .sort({ createdAt: -1, _id: -1 })
    .explain("executionStats");
  assert.match(
    JSON.stringify(plan.queryPlanner.winningPlan),
    /userId_1_createdAt_-1__id_-1/,
  );
  assert.doesNotMatch(
    JSON.stringify(plan.queryPlanner.winningPlan),
    /"stage":"SORT"/,
  );
  const lookup = await User.aggregate(
    userPostsPipeline(alice.user._id, { skip: 0, limit: 10 }),
  ).explain("executionStats");
  assert.match(JSON.stringify(lookup), /userId_1_createdAt_-1__id_-1/);
  console.log(
    "Verified owner-sort and posts lookup index use on MongoDB 7.0.24",
  );
});

test("interests operation excludes blanks without auxiliary database queries", async () => {
  const { groupInterests } = await import("../src/controllers/users.js");
  const blank = await User.collection.insertOne({
    name: "Blank interests",
    interests: ["", "   "],
  });
  const methods = [
    "find",
    "findOne",
    "findById",
    "countDocuments",
    "estimatedDocumentCount",
    "distinct",
  ];
  const originals = Object.fromEntries(
    methods.map((name) => [name, User[name]]),
  );
  const originalAggregate = User.aggregate;
  let calls = 0;
  try {
    for (const name of methods)
      User[name] = () => {
        throw new Error(`Unexpected ${name} in interests operation`);
      };
    User.aggregate = function (pipeline) {
      calls++;
      return originalAggregate.call(this, pipeline);
    };
    let response;
    await groupInterests(
      { query: {} },
      {
        json: (value) => {
          response = value;
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(response.data.total, 3);
    assert.ok(response.data.results.every((group) => group.interest.trim()));
  } finally {
    Object.assign(User, originals);
    User.aggregate = originalAggregate;
    await User.collection.deleteOne({ _id: blank.insertedId });
  }
});
