const { verifyToken } = require("../utils/token");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Invalid authentication token format. Use Bearer <token>" });
  }

  const token = parts[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
  }

  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    const decoded = verifyToken(parts[1]);
    if (decoded) {
      req.user = decoded;
    } else {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
};
