function notFoundHandler(req, res, next) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Request body must be valid JSON" });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request payload is too large" });
  }

  if (err.name === "CastError" || err.name === "BSONError") {
    return res.status(400).json({ error: "Invalid id" });
  }

  if (err.name === "ValidationError") {
    const firstKey = Object.keys(err.errors)[0];
    const message = firstKey ? err.errors[firstKey].message : "Validation failed";
    return res.status(400).json({ error: message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: "An entry with this value already exists" });
  }

  console.error("[ServerError]", err);
  res.status(500).json({ error: "Something went wrong on the server" });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
