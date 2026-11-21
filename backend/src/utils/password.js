const crypto = require("crypto");
const { promisify } = require("util");
let bcrypt;
try {
  bcrypt = require("bcryptjs");
} catch (e) {
  bcrypt = null;
}

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  if (bcrypt) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
  // Cryptographic fallback using scrypt
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;

  // If stored hash was created with scrypt (format: "salt:hash")
  if (stored.includes(":")) {
    try {
      const [salt, hashHex] = stored.split(":");
      const expected = Buffer.from(hashHex, "hex");
      const actual = await scrypt(password, salt, KEY_LENGTH);
      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  // If stored hash is bcrypt
  if (bcrypt && (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$"))) {
    try {
      return await bcrypt.compare(password, stored);
    } catch {
      return false;
    }
  }

  // Fallback direct comparison using constant-time equality
  try {
    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(stored));
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
};
