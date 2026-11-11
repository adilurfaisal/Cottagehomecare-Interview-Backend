export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function objectId(req, _res, next, value) {
  if (!/^[a-f\d]{24}$/i.test(value)) fail(400, "Invalid ID");
  next();
}

export function pagination(req) {
  const readPageNumber = (key, fallback, max) => {
    const value = req.query[key] ?? String(fallback);
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value))
      fail(400, `Invalid ${key}`);
    const pageNumber = Number(value);
    if (!Number.isSafeInteger(pageNumber) || pageNumber > max)
      fail(400, `${key} exceeds ${max}`);
    return pageNumber;
  };
  const page = readPageNumber("page", 1, 1000000);
  const limit = readPageNumber("limit", 10, 100);

  return { page, limit, skip: (page - 1) * limit };
}

export function pageResult(results, total, { page, limit }) {
  return { page, limit, total, totalPages: Math.ceil(total / limit), results };
}

export function text(value, field, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    fail(400, `${field} is required and must be at most ${max} characters`);
  }

  return value.trim();
}

export function userInput(body, { partial = false, admin = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(400, "Invalid request body");
  const result = {};
  if (!partial || body.name !== undefined)
    result.name = text(body.name, "Name", 100);
  if (!partial || body.email !== undefined) {
    result.email = text(body.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
      fail(400, "Invalid email");
  }
  if (!partial || body.password !== undefined) {
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      Buffer.byteLength(body.password) > 72
    ) {
      fail(400, "Password must be at least 8 characters and at most 72 bytes");
    }
    result.password = body.password;
  }
  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests) || body.interests.length > 20)
      fail(400, "Interests must be an array of at most 20 strings");
    result.interests = [
      ...new Set(
        body.interests.map((value) =>
          text(value, "Interest", 50).toLowerCase(),
        ),
      ),
    ];
  }
  if (admin && body.role !== undefined) {
    if (!["user", "admin"].includes(body.role)) fail(400, "Invalid role");
    result.role = body.role;
  }

  return result;
}

export function noteInput(body) {
  return {
    title: text(body?.title, "Title", 200),
    content: text(body?.content, "Content", 20000),
  };
}
