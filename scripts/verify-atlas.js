const path = require("path");
const fs = require("fs");

// Priority 1: Project root .env; Priority 2: backend/.env
const rootEnvPath = path.resolve(__dirname, "../.env");
const backendEnvPath = path.resolve(__dirname, "../backend/.env");

if (fs.existsSync(rootEnvPath)) {
  require("dotenv").config({ path: rootEnvPath });
} else if (fs.existsSync(backendEnvPath)) {
  require("dotenv").config({ path: backendEnvPath });
}

const mongoose = require("mongoose");
const { validateAndFormatUri } = require("../backend/src/configuration/database");

async function verifyAtlas() {
  console.log("=================================================");
  console.log("       MongoDB Atlas Live Connection Auditor     ");
  console.log("=================================================");

  const rawUri = (process.env.MONGODB_URI || "").trim();
  const validation = validateAndFormatUri(rawUri);

  if (!validation.valid) {
    console.error(`\n[CONFIG ERROR] ${validation.error}`);
    console.log("Please check your .env file and ensure MONGODB_URI is correctly formatted.");
    process.exit(1);
  }

  console.log(`Connecting to Atlas URI: ${validation.sanitized}`);

  try {
    const conn = await mongoose.connect(validation.uri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 10000,
    });

    console.log("\n[SUCCESS] Connected to live MongoDB Atlas cluster!");
    console.log(`- Database Name: "${mongoose.connection.name}"`);
    console.log(`- Connection State: ${mongoose.connection.readyState} (1 = Connected)`);
    console.log(`- Cluster Host: ${conn.connection.host}`);

    // Harmless database ping to verify read/write connectivity
    console.log("\nExecuting database ping command...");
    const pingRes = await mongoose.connection.db.admin().ping();
    console.log("- Ping Response:", JSON.stringify(pingRes));

    // Audit collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\nExisting Collections in "${mongoose.connection.name}":`, collections.map((c) => c.name));

    // Check models if collections exist
    const User = require("../backend/src/models/user.model");
    const Device = require("../backend/src/models/device.model");
    const Room = require("../backend/src/models/room.model");
    const Message = require("../backend/src/models/message.model");

    const [userCount, deviceCount, roomCount, messageCount] = await Promise.all([
      User.countDocuments().catch(() => 0),
      Device.countDocuments().catch(() => 0),
      Room.countDocuments().catch(() => 0),
      Message.countDocuments().catch(() => 0),
    ]);

    console.log("\nDocument Counts in Atlas:");
    console.log(`- users: ${userCount}`);
    console.log(`- devices: ${deviceCount}`);
    console.log(`- rooms: ${roomCount}`);
    console.log(`- messages: ${messageCount}`);

    console.log("\n=================================================");
    console.log("       Atlas Live Verification Succeeded!        ");
    console.log("=================================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    const msg = err.message || "";
    console.error("\n[FAILED] Could not connect to MongoDB Atlas:");
    console.error(`- Error: ${msg}`);

    console.log("\nTROUBLESHOOTING STEPS:");
    if (msg.includes("bad auth") || msg.includes("Authentication failed")) {
      console.log("1. Open MongoDB Atlas at https://cloud.mongodb.com/");
      console.log("2. Navigate to 'Database Access' under Security in the left sidebar.");
      console.log("3. Locate your database user and click 'Edit' (pencil icon).");
      console.log("4. Click 'Edit Password', enter or generate a new password, and click 'Update User'.");
      console.log("5. Update your .env file with that exact password (without any 'MONGODB_URI=' prefix).");
      console.log("6. Re-run 'npm run verify:atlas'.");
    } else if (msg.includes("whitelist") || msg.includes("Could not connect to any servers")) {
      console.log("1. Open MongoDB Atlas at https://cloud.mongodb.com/");
      console.log("2. Navigate to 'Network Access' under Security.");
      console.log("3. Click 'Add IP Address' -> Select 'Allow Access from Anywhere' (0.0.0.0/0) or add your current IP.");
      console.log("4. Wait 1-2 minutes for the network rule to become Active, then re-run this script.");
    } else {
      console.log("Please check your internet connection, DNS configuration, and MONGODB_URI in .env.");
    }

    process.exit(1);
  }
}

verifyAtlas();
