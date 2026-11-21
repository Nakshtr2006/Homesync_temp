const path = require("path");

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "homesync_jwt_super_secret_key_2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

// Default data directory: project root data/ or backend data/
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;

module.exports = {
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  CLIENT_ORIGIN,
  DATA_DIR,
};
