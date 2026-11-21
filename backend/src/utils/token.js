const crypto = require("crypto");
let jwt;
try {
  jwt = require("jsonwebtoken");
} catch (e) {
  jwt = null;
}
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../configuration/constants");

function generateToken(payload) {
  if (jwt) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Safe crypto fallback if jsonwebtoken module is not available
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${data}`)
    .digest("base64url");

  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;

  if (jwt) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  // Verification fallback
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${data}`)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
};
