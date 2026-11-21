const mongoose = require("mongoose");

let cachedConnection = null;
let isConnecting = false;
let lastConnectionError = null;

/**
 * Validates and formats the MongoDB connection string.
 * - Strips accidental 'MONGODB_URI=' prefix if present.
 * - Ensures scheme starts with 'mongodb://' or 'mongodb+srv://'.
 * - Properly encodes username/password reserved characters without double-encoding.
 * - Ensures database name is 'homesync'.
 * - Returns sanitized URI for safe logging (credentials redacted).
 */
function validateAndFormatUri(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return {
      valid: false,
      error: "MONGODB_URI environment variable is missing or empty.",
    };
  }

  let uri = rawInput.trim();

  // Strip accidental leading 'MONGODB_URI=' prefix
  while (uri.startsWith("MONGODB_URI=")) {
    uri = uri.substring("MONGODB_URI=".length).trim();
  }

  // Strip wrapping quotes if present
  if (
    (uri.startsWith('"') && uri.endsWith('"')) ||
    (uri.startsWith("'") && uri.endsWith("'"))
  ) {
    uri = uri.slice(1, -1).trim();
  }

  if (uri.includes("<db_password>")) {
    return {
      valid: false,
      error: "MONGODB_URI contains '<db_password>' placeholder. Please replace it with your Atlas password.",
    };
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    return {
      valid: false,
      error: 'Invalid connection scheme: MONGODB_URI must begin with "mongodb://" or "mongodb+srv://".',
    };
  }

  const protoIdx = uri.indexOf("://");
  const protocol = uri.substring(0, protoIdx + 3);
  const afterProto = uri.substring(protoIdx + 3);

  const lastAt = afterProto.lastIndexOf("@");
  if (lastAt === -1) {
    // No credentials provided
    return {
      valid: true,
      uri,
      sanitized: uri,
    };
  }

  const creds = afterProto.substring(0, lastAt);
  let hostAndRest = afterProto.substring(lastAt + 1);

  const colonIdx = creds.indexOf(":");
  if (colonIdx === -1) {
    return {
      valid: false,
      error: "Malformed credentials: Expected format 'username:password@cluster'.",
    };
  }

  const rawUser = creds.substring(0, colonIdx);
  const rawPass = creds.substring(colonIdx + 1);

  // Decode first to prevent double-encoding, then encode once
  let cleanUser;
  try {
    cleanUser = encodeURIComponent(decodeURIComponent(rawUser));
  } catch {
    cleanUser = encodeURIComponent(rawUser);
  }

  let cleanPass;
  try {
    cleanPass = encodeURIComponent(decodeURIComponent(rawPass));
  } catch {
    cleanPass = encodeURIComponent(rawPass);
  }

  // Ensure /homesync database path
  if (
    hostAndRest.startsWith("cluster0.ed0icoo.mongodb.net/?") ||
    hostAndRest === "cluster0.ed0icoo.mongodb.net/" ||
    hostAndRest === "cluster0.ed0icoo.mongodb.net"
  ) {
    hostAndRest = hostAndRest.replace(
      "cluster0.ed0icoo.mongodb.net",
      "cluster0.ed0icoo.mongodb.net/homesync"
    );
  } else if (!hostAndRest.includes("/homesync") && hostAndRest.includes("?")) {
    const qIdx = hostAndRest.indexOf("?");
    hostAndRest =
      hostAndRest.substring(0, qIdx) + "homesync" + hostAndRest.substring(qIdx);
  }

  const formattedUri = `${protocol}${cleanUser}:${cleanPass}@${hostAndRest}`;
  const sanitized = `${protocol}****:****@${hostAndRest}`;

  return {
    valid: true,
    uri: formattedUri,
    sanitized,
  };
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function getLastConnectionError() {
  return lastConnectionError;
}

async function connectDb() {
  if (mongoReady()) {
    return true;
  }

  if (isConnecting) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!isConnecting) {
          clearInterval(interval);
          resolve(mongoReady());
        }
      }, 100);
    });
  }

  const rawUri = (process.env.MONGODB_URI || "").trim();
  const validation = validateAndFormatUri(rawUri);

  if (!validation.valid) {
    lastConnectionError = validation.error;
    console.error(`[MongoDB Configuration Error] ${validation.error}`);
    return false;
  }

  try {
    isConnecting = true;
    lastConnectionError = null;
    console.log(`[MongoDB] Connecting to MongoDB Atlas: ${validation.sanitized}`);

    const conn = await mongoose.connect(validation.uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    cachedConnection = conn;
    isConnecting = false;

    console.log(`[MongoDB] Successfully connected to MongoDB Atlas!`);
    console.log(`[MongoDB] Database Name: "${mongoose.connection.name}"`);
    console.log(`[MongoDB] Connection State: ${mongoose.connection.readyState} (1 = Connected)`);
    console.log(`[MongoDB] Cluster Host: ${conn.connection.host}`);
    return true;
  } catch (err) {
    isConnecting = false;

    const msg = err.message || "";
    if (msg.includes("bad auth") || msg.includes("Authentication failed") || msg.includes("auth error")) {
      lastConnectionError = `Authentication failed: Invalid database username or password for Atlas cluster. (${msg})`;
      console.error(`[MongoDB Atlas Auth Error] ${lastConnectionError}`);
    } else if (msg.includes("whitelist") || msg.includes("Could not connect to any servers")) {
      lastConnectionError = `Network restriction: Client IP is not allowed to connect to Atlas cluster. Add 0.0.0.0/0 or your current IP in Atlas Network Access. (${msg})`;
      console.error(`[MongoDB Atlas Network Error] ${lastConnectionError}`);
    } else if (msg.includes("ENOTFOUND") || msg.includes("querySrv")) {
      lastConnectionError = `DNS resolution error: Unable to resolve Atlas cluster address. (${msg})`;
      console.error(`[MongoDB Atlas DNS Error] ${lastConnectionError}`);
    } else {
      lastConnectionError = `MongoDB Atlas connection error: ${msg}`;
      console.error(`[MongoDB Atlas Error] ${lastConnectionError}`);
    }

    return false;
  }
}

async function closeDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cachedConnection = null;
  }
}

function requireDb(req, res, next) {
  if (!mongoReady()) {
    return res.status(503).json({
      error: "Database is not connected to MongoDB Atlas.",
      details: lastConnectionError || "Please verify Atlas credentials and network access.",
    });
  }
  next();
}

module.exports = {
  connectDb,
  closeDb,
  mongoReady,
  requireDb,
  validateAndFormatUri,
  getLastConnectionError,
};
