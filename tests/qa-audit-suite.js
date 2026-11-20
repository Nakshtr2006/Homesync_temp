const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const http = require("http");
const fs = require("fs");
const path = require("path");

let mongod;
let server;
let baseUrl;

const results = [];

function assert(condition, testName, details = "") {
  if (condition) {
    results.push({ pass: true, test: testName });
    console.log(`  [PASS] ${testName}`);
  } else {
    results.push({ pass: false, test: testName, error: details });
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, ok: response.ok, data };
}

async function setup() {
  console.log("=== Starting Local MongoDB Engine for In-Depth QA Testing ===");
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.PORT = "3055";

  // Use test data directory to avoid polluting production data
  const testDataDir = path.join(__dirname, "test-data");
  process.env.DATA_DIR = testDataDir;
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }

  // Load app modules
  const express = require("express");
  const cors = require("cors");
  const devicesRouter = require("../routes/devices");
  const roomsRouter = require("../routes/rooms");
  const usersRouter = require("../routes/users");
  const messagesRouter = require("../routes/messages");
  const weatherRouter = require("../routes/weather");
  const { connectDb, mongoReady } = require("../lib/db");
  const { seedIfEmpty } = require("../lib/seed");

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10kb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "HomeSync API is running", mongo: mongoReady() });
  });

  app.use("/api/devices", devicesRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/weather", weatherRouter);

  const pages = {
    "/": "index.html",
    "/index.html": "index.html",
    "/login.html": "login.html",
    "/settings.html": "settings.html",
    "/contact.html": "contact.html",
    "/style.css": "style.css",
    "/client.js": "client.js",
    "/app.js": "app.js",
  };

  Object.entries(pages).forEach(([route, file]) => {
    app.get(route, (req, res) => {
      res.sendFile(path.join(__dirname, "..", file));
    });
  });

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Request body must be valid JSON" });
    }
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid id" });
    }
    res.status(500).json({ error: "Something went wrong on the server" });
  });

  await connectDb();
  await seedIfEmpty();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(3055, resolve));
  baseUrl = "http://127.0.0.1:3055";
  console.log(`Test server active at ${baseUrl}`);
}

async function teardown() {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
  const testDataDir = path.join(__dirname, "test-data");
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
}

async function runAudit() {
  try {
    await setup();

    console.log("\n--- TEST SUITE 1: System Health & Static Assets ---");
    const health = await request("/api/health");
    assert(health.status === 200 && health.data.mongo === true, "Health endpoint confirms server & MongoDB connection");

    const indexPage = await request("/");
    assert(indexPage.status === 200 && typeof indexPage.data === "string" && indexPage.data.includes("HomeSync"), "Static index.html served correctly");

    const contactPage = await request("/contact.html");
    assert(contactPage.status === 200 && contactPage.data.includes("Contact"), "Static contact.html served correctly");

    const loginPage = await request("/login.html");
    assert(loginPage.status === 200 && loginPage.data.includes("Login"), "Static login.html served correctly");

    const settingsPage = await request("/settings.html");
    assert(settingsPage.status === 200 && settingsPage.data.includes("Settings"), "Static settings.html served correctly");

    const notFound = await request("/nonexistent-page-xyz");
    assert(notFound.status === 404 && notFound.data.error === "Not found", "404 handler returns structured JSON error");

    console.log("\n--- TEST SUITE 2: External Weather API Integration ---");
    const weatherDelhi = await request("/api/weather?city=Delhi");
    assert(weatherDelhi.status === 200 && weatherDelhi.data.city === "Delhi" && typeof weatherDelhi.data.temperature === "number", "Weather API fetches live data for Delhi");

    const weatherDefault = await request("/api/weather");
    assert(weatherDefault.status === 200 && weatherDefault.data.city === "Delhi", "Weather API defaults to Delhi when city param is omitted");

    const weatherTokyo = await request("/api/weather?city=Tokyo");
    assert(weatherTokyo.status === 200 && weatherTokyo.data.city === "Tokyo" && weatherTokyo.data.condition, "Weather API fetches live data for Tokyo");

    const weatherInvalid = await request("/api/weather?city=InvalidNonExistentCityXYZ999");
    assert(weatherInvalid.status === 404, "Weather API returns 404 for unresolvable city");

    const weatherEmpty = await request("/api/weather?city=%20");
    assert(weatherEmpty.status === 400, "Weather API returns 400 for whitespace-only city");

    console.log("\n--- TEST SUITE 3: Local JSON Storage — Contact Messages ---");
    const validMsg = {
      name: "Security Auditor",
      email: "auditor@qa-firm.com",
      subject: "Security Audit Report",
      message: "This message verifies local file system persistence.",
    };
    const createMsg = await request("/api/messages", { method: "POST", body: validMsg });
    assert(createMsg.status === 201 && createMsg.data.id && createMsg.data.createdAt, "Create contact message returns 201 with UUID and timestamp");

    const allMsgs = await request("/api/messages");
    assert(Array.isArray(allMsgs.data) && allMsgs.data.some((m) => m.id === createMsg.data.id), "Read contact messages returns created message");

    // Disk-level verification of data/messages.json
    const messagesFile = path.join(process.env.DATA_DIR, "messages.json");
    const fileExists = fs.existsSync(messagesFile);
    const fileContents = fileExists ? JSON.parse(fs.readFileSync(messagesFile, "utf8")) : [];
    assert(fileExists && fileContents.some((m) => m.id === createMsg.data.id), "Direct filesystem audit: messages.json contains persisted message");

    // Validation edge cases
    const badEmail = await request("/api/messages", { method: "POST", body: { ...validMsg, email: "invalid-email" } });
    assert(badEmail.status === 400, "Reject message with invalid email format");

    const missingName = await request("/api/messages", { method: "POST", body: { ...validMsg, name: "" } });
    assert(missingName.status === 400, "Reject message with missing name");

    console.log("\n--- TEST SUITE 4: Authentication, Authorization & Two-User Separation ---");
    // User A (Alice)
    const aliceData = { name: "Alice Smith", email: "alice@example.com", password: "Password123" };
    const aliceSignup = await request("/api/users/signup", { method: "POST", body: aliceData });
    assert(aliceSignup.status === 201 && aliceSignup.data.id && aliceSignup.data.passwordHash === undefined, "Alice signup succeeds and passwordHash is NEVER exposed");
    const aliceId = aliceSignup.data.id;

    // User B (Bob)
    const bobData = { name: "Bob Jones", email: "bob@example.com", password: "SecretPassword987" };
    const bobSignup = await request("/api/users/signup", { method: "POST", body: bobData });
    assert(bobSignup.status === 201 && bobSignup.data.id, "Bob signup succeeds with independent account ID");
    const bobId = bobSignup.data.id;

    // Duplicate email
    const duplicateSignup = await request("/api/users/signup", { method: "POST", body: aliceData });
    assert(duplicateSignup.status === 409, "Signup rejects duplicate email address with 409 Conflict");

    // Password validation (<8 chars or no numbers)
    const weakPassSignup = await request("/api/users/signup", { method: "POST", body: { name: "Weak", email: "weak@ex.com", password: "short" } });
    assert(weakPassSignup.status === 400, "Signup rejects password with fewer than 8 characters");

    // Login Alice
    const aliceLogin = await request("/api/users/login", { method: "POST", body: { email: aliceData.email, password: aliceData.password } });
    assert(aliceLogin.status === 200 && aliceLogin.data.name === "Alice Smith", "Alice logs in successfully with valid credentials");

    // Login Bob
    const bobLogin = await request("/api/users/login", { method: "POST", body: { email: bobData.email, password: bobData.password } });
    assert(bobLogin.status === 200 && bobLogin.data.name === "Bob Jones", "Bob logs in successfully with valid credentials");

    // Login wrong password
    const badLogin = await request("/api/users/login", { method: "POST", body: { email: aliceData.email, password: "WrongPassword999" } });
    assert(badLogin.status === 401, "Login fails with 401 Unauthorized for incorrect password");

    // Authorization attack: Bob attempts to update Alice's profile using Bob's password
    const crossUpdateAttack = await request(`/api/users/${aliceId}`, {
      method: "PATCH",
      body: { name: "Hacked Alice", email: "alice@example.com", currentPassword: bobData.password },
    });
    assert(crossUpdateAttack.status === 401, "Cross-user authorization check: Bob cannot modify Alice's profile using Bob's password");

    // Legitimate Profile Update: Alice updates her name using Alice's current password
    const aliceUpdate = await request(`/api/users/${aliceId}`, {
      method: "PATCH",
      body: { name: "Alice Johnson", email: "alice_new@example.com", currentPassword: aliceData.password },
    });
    assert(aliceUpdate.status === 200 && aliceUpdate.data.name === "Alice Johnson", "Alice successfully updates profile with current password");

    // Verify on disk in data/users.json
    const usersFile = path.join(process.env.DATA_DIR, "users.json");
    const usersOnDisk = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    const aliceOnDisk = usersOnDisk.find((u) => u.id === aliceId);
    assert(aliceOnDisk && aliceOnDisk.name === "Alice Johnson" && aliceOnDisk.email === "alice_new@example.com", "Direct filesystem audit: users.json persisted Alice's profile changes");

    // Password Rotation for Alice
    const alicePassChange = await request(`/api/users/${aliceId}/password`, {
      method: "PATCH",
      body: { currentPassword: aliceData.password, newPassword: "UpdatedPassword456" },
    });
    assert(alicePassChange.status === 200, "Alice changes password successfully");

    // Old password must fail
    const oldPassLogin = await request("/api/users/login", { method: "POST", body: { email: "alice_new@example.com", password: aliceData.password } });
    assert(oldPassLogin.status === 401, "Old password is invalidated and cannot be used to log in");

    // New password must succeed
    const newPassLogin = await request("/api/users/login", { method: "POST", body: { email: "alice_new@example.com", password: "UpdatedPassword456" } });
    assert(newPassLogin.status === 200, "New password successfully authenticates Alice");

    // Cross-user Account Deletion Attack: Bob attempts to delete Alice's account with wrong password
    const crossDeleteAttack = await request(`/api/users/${aliceId}`, {
      method: "DELETE",
      body: { currentPassword: "InvalidPassword" },
    });
    assert(crossDeleteAttack.status === 401, "Unauthorized account deletion rejected with 401");

    // Legitimate Account Deletion
    const aliceDelete = await request(`/api/users/${aliceId}`, {
      method: "DELETE",
      body: { currentPassword: "UpdatedPassword456" },
    });
    assert(aliceDelete.status === 204, "Alice successfully deletes account with 204 No Content");

    // Verify Alice cannot login anymore
    const deletedLogin = await request("/api/users/login", { method: "POST", body: { email: "alice_new@example.com", password: "UpdatedPassword456" } });
    assert(deletedLogin.status === 401, "Deleted account cannot log in");

    // Verify Bob is still intact on disk
    const usersAfterDelete = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    assert(usersAfterDelete.length === 1 && usersAfterDelete[0].id === bobId, "Direct filesystem audit: Alice removed, Bob account intact in users.json");

    console.log("\n--- TEST SUITE 5: MongoDB Persistence & Full CRUD (Devices & Rooms) ---");
    // Initial Seed Verification
    const seededRooms = await request("/api/rooms");
    assert(Array.isArray(seededRooms.data) && seededRooms.data.length === 3, "Database seeding verified: 3 initial sample rooms loaded");

    const seededDevices = await request("/api/devices");
    assert(Array.isArray(seededDevices.data) && seededDevices.data.length === 4, "Database seeding verified: 4 initial sample devices loaded");

    // Room CRUD: Create
    const newRoom = await request("/api/rooms", { method: "POST", body: { name: "Study Room" } });
    assert(newRoom.status === 201 && newRoom.data.id && newRoom.data.name === "Study Room", "Create Room: POST /api/rooms returns 201 with ID");
    const roomId = newRoom.data.id;

    // Room CRUD: Duplicate Check
    const duplicateRoom = await request("/api/rooms", { method: "POST", body: { name: "study room" } });
    assert(duplicateRoom.status === 409, "Create Room: Rejects case-insensitive duplicate room with 409");

    // Room CRUD: Read Single by ID
    const singleRoom = await request(`/api/rooms/${roomId}`);
    assert(singleRoom.status === 200 && singleRoom.data.name === "Study Room" && singleRoom.data.deviceCount === 0, "Read Single Room: GET /api/rooms/:id returns room details");

    // Device CRUD: Create
    const newDevice = await request("/api/devices", {
      method: "POST",
      body: { name: "Desk Lamp", room: "Study Room", type: "Light" },
    });
    assert(newDevice.status === 201 && newDevice.data.id && newDevice.data.isOn === false, "Create Device: POST /api/devices returns 201 with isOn=false");
    const deviceId = newDevice.data.id;

    // Device CRUD: Read Single by ID
    const singleDevice = await request(`/api/devices/${deviceId}`);
    assert(singleDevice.status === 200 && singleDevice.data.name === "Desk Lamp", "Read Single Device: GET /api/devices/:id returns device details");

    // Verify Device Count increment on Room
    const roomWithDevice = await request(`/api/rooms/${roomId}`);
    assert(roomWithDevice.data.deviceCount === 1, "Room dynamic counter: deviceCount incremented to 1");

    // Device CRUD: Update (Toggle on + Rename)
    const updateDevice = await request(`/api/devices/${deviceId}`, {
      method: "PATCH",
      body: { isOn: true, name: "Smart Study Lamp" },
    });
    assert(updateDevice.status === 200 && updateDevice.data.isOn === true && updateDevice.data.name === "Smart Study Lamp", "Update Device: PATCH /api/devices/:id toggles isOn=true and updates name");

    // Room CRUD: Update (Rename room with Cascade to devices)
    const renameRoom = await request(`/api/rooms/${roomId}`, {
      method: "PATCH",
      body: { name: "Executive Library" },
    });
    assert(renameRoom.status === 200 && renameRoom.data.name === "Executive Library", "Update Room: PATCH /api/rooms/:id renames room");

    // Verify device room name was automatically cascaded
    const cascadedDevice = await request(`/api/devices/${deviceId}`);
    assert(cascadedDevice.data.room === "Executive Library", "Data Integrity: Renaming room cascaded device.room to 'Executive Library'");

    // Device CRUD: Delete
    const deleteDevice = await request(`/api/devices/${deviceId}`, { method: "DELETE" });
    assert(deleteDevice.status === 204, "Delete Device: DELETE /api/devices/:id returns 204 No Content");

    const getDeletedDevice = await request(`/api/devices/${deviceId}`);
    assert(getDeletedDevice.status === 404, "Verify Device Deletion: GET /api/devices/:id returns 404 Not Found");

    // Room CRUD: Delete
    const deleteRoom = await request(`/api/rooms/${roomId}`, { method: "DELETE" });
    assert(deleteRoom.status === 204, "Delete Room: DELETE /api/rooms/:id returns 204 No Content");

    const getDeletedRoom = await request(`/api/rooms/${roomId}`);
    assert(getDeletedRoom.status === 404, "Verify Room Deletion: GET /api/rooms/:id returns 404 Not Found");

    // Mongoose CastError handling (invalid ObjectId format)
    const malformedId = await request("/api/devices/not-a-valid-id-123");
    assert(malformedId.status === 400 && malformedId.data.error === "Invalid id", "Error Handling: Invalid ObjectId returns 400 Invalid id");

    console.log("\n=======================================================");
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log(`QA AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${results.length})`);
    console.log("=======================================================\n");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Fatal Test Failure:", err);
    process.exit(1);
  } finally {
    await teardown();
  }
}

runAudit();
