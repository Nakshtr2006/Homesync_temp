const mongoose = require("mongoose");

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

async function connectDb() {
  const uri = (process.env.MONGODB_URI || "").trim();
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log("Connected to MongoDB Atlas");
      return true;
    } catch (err) {
      console.warn("MongoDB Atlas connection could not be established (network/IP restriction):", err.message);
      console.log("Automatically switching to local MongoDB engine...");
    }
  }

  try {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    const localUri = mongod.getUri();
    await mongoose.connect(localUri);
    console.log("Connected to local MongoDB engine (offline mode)");
    return true;
  } catch (localErr) {
    console.error("Local MongoDB fallback error:", localErr.message);
    return false;
  }
}

function requireDb(req, res, next) {
  if (!mongoReady()) {
    return res.status(503).json({
      error: "Database is not connected. Add MONGODB_URI to the .env file and restart the server.",
    });
  }
  next();
}

module.exports = { connectDb, mongoReady, requireDb };
