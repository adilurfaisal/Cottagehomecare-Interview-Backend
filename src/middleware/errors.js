export function errors(error, _req, res, _next) {
  let status = error.status || 500;
  let message = error.message;
  if (error.code === 11000) {
    status = 409;
    message = "Email is already registered";
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    status = 400;
    message = "Invalid input";
  }
  if (status >= 500) {
    console.error(error);
    message = "Internal server error";
  }

  res.status(status).json({ success: false, message });
}
