const http = require("http");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

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

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
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
  console.log("=== Setting Up Integration Test Environment ===");
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = "3056";

  const testDataDir = path.join(__dirname, "test-integration-data");
  process.env.DATA_DIR = testDataDir;
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }

  const { connectDb } = require("../backend/src/configuration/database");
  const { seedIfEmpty } = require("../backend/src/configuration/seed");
  const app = require("../backend/src/app");

  await connectDb();
  await seedIfEmpty();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(3056, resolve));
  baseUrl = "http://127.0.0.1:3056";
  console.log(`Integration test server running at ${baseUrl}`);
}

async function teardown() {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
  const testDataDir = path.join(__dirname, "test-integration-data");
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
}

async function runTests() {
  try {
    await setup();

    console.log("\n--- TEST: GET /api/health ---");
    const health = await request("/api/health");
    assert(health.status === 200, "Health check responds with 200");
    assert(health.data.mongo === true, "Health check confirms MongoDB is connected");
    assert(health.data.database === "connected", "Health check reports database connected");

    console.log("\n--- TEST: User Signup & JWT Auth ---");
    const userPayload = {
      name: "Trisha Alankar",
      email: "trisha@homesync.io",
      password: "StrongPassword2026",
    };
    const signupRes = await request("/api/auth/signup", {
      method: "POST",
      body: userPayload,
    });
    assert(signupRes.status === 201, "POST /api/auth/signup returns 201 Created");
    assert(signupRes.data.token, "Signup response contains JWT token");
    assert(signupRes.data.name === "Trisha Alankar", "User name is saved accurately");
    assert(!signupRes.data.passwordHash, "passwordHash is not exposed");

    const token = signupRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    const userId = signupRes.data.id;

    console.log("\n--- TEST: Profile & Settings APIs ---");
    const getProfile = await request(`/api/users/${userId}`, { headers: authHeaders });
    assert(getProfile.status === 200 && getProfile.data.email === "trisha@homesync.io", "GET /api/users/:id fetches saved profile from MongoDB");

    // Preferences update
    const prefRes = await request(`/api/users/${userId}/preferences`, {
      method: "PATCH",
      headers: authHeaders,
      body: { dark: true, lang: "hi", unit: "F", emailNotif: true, deviceNotif: false },
    });
    assert(prefRes.status === 200 && prefRes.data.preferences.unit === "F", "PATCH /api/users/:id/preferences persists preferences to MongoDB");

    console.log("\n--- TEST: Full Device CRUD Operations (MongoDB) ---");
    // 1. Create Device
    const devCreate = await request("/api/devices", {
      method: "POST",
      headers: authHeaders,
      body: { name: "Balcony Floodlight", room: "Living Room", type: "Light" },
    });
    assert(devCreate.status === 201 && devCreate.data.id, "POST /api/devices creates new device in MongoDB");
    const deviceId = devCreate.data.id;

    // 2. Read All Devices
    const devList = await request("/api/devices", { headers: authHeaders });
    assert(devList.status === 200 && devList.data.some((d) => d.id === deviceId), "GET /api/devices lists user devices from MongoDB");

    // 3. Read Single Device
    const devSingle = await request(`/api/devices/${deviceId}`, { headers: authHeaders });
    assert(devSingle.status === 200 && devSingle.data.name === "Balcony Floodlight", "GET /api/devices/:id fetches single device");

    // 4. PUT Device (Full update)
    const devPut = await request(`/api/devices/${deviceId}`, {
      method: "PUT",
      headers: authHeaders,
      body: { name: "Balcony LED Spot", room: "Living Room", type: "Spotlight", isOn: true },
    });
    assert(devPut.status === 200 && devPut.data.name === "Balcony LED Spot" && devPut.data.isOn === true, "PUT /api/devices/:id fully updates device in MongoDB");

    // 5. PATCH Device (Partial update / power toggle)
    const devPatch = await request(`/api/devices/${deviceId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: { isOn: false },
    });
    assert(devPatch.status === 200 && devPatch.data.isOn === false, "PATCH /api/devices/:id updates power status in MongoDB");

    // 6. Delete Device
    const devDelete = await request(`/api/devices/${deviceId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert(devDelete.status === 204, "DELETE /api/devices/:id deletes device from MongoDB");

    const devCheckDeleted = await request(`/api/devices/${deviceId}`, { headers: authHeaders });
    assert(devCheckDeleted.status === 404, "GET /api/devices/:id confirms device is deleted");

    console.log("\n--- TEST: Full Room CRUD Operations (MongoDB) ---");
    // 1. Create Room
    const roomCreate = await request("/api/rooms", {
      method: "POST",
      headers: authHeaders,
      body: { name: "Home Theater" },
    });
    assert(roomCreate.status === 201 && roomCreate.data.id, "POST /api/rooms creates new room in MongoDB");
    const roomId = roomCreate.data.id;

    // 2. Read All Rooms
    const roomList = await request("/api/rooms", { headers: authHeaders });
    assert(roomList.status === 200 && roomList.data.some((r) => r.id === roomId), "GET /api/rooms returns user rooms from MongoDB");

    // 3. Read Single Room
    const roomSingle = await request(`/api/rooms/${roomId}`, { headers: authHeaders });
    assert(roomSingle.status === 200 && roomSingle.data.name === "Home Theater", "GET /api/rooms/:id returns single room");

    // 4. PUT Room (Full rename)
    const roomPut = await request(`/api/rooms/${roomId}`, {
      method: "PUT",
      headers: authHeaders,
      body: { name: "Cinema Lounge" },
    });
    assert(roomPut.status === 200 && roomPut.data.name === "Cinema Lounge", "PUT /api/rooms/:id renames room in MongoDB");

    // 5. PATCH Room (Partial rename)
    const roomPatch = await request(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: { name: "Media Room" },
    });
    assert(roomPatch.status === 200 && roomPatch.data.name === "Media Room", "PATCH /api/rooms/:id updates room in MongoDB");

    // 6. Delete Room
    const roomDelete = await request(`/api/rooms/${roomId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert(roomDelete.status === 204, "DELETE /api/rooms/:id deletes room from MongoDB");

    const roomCheckDeleted = await request(`/api/rooms/${roomId}`, { headers: authHeaders });
    assert(roomCheckDeleted.status === 404, "GET /api/rooms/:id confirms room is deleted");

    console.log("\n--- TEST: Full Contact Messages CRUD (Local JSON & MongoDB) ---");
    // 1. POST Message
    const msgPayload = {
      name: "Professor Evaluator",
      email: "evaluator@university.edu",
      subject: "Lab Evaluation In Progress",
      message: "Testing local JSON file read/write operations along with MongoDB mirroring.",
    };
    const msgCreate = await request("/api/messages", {
      method: "POST",
      headers: authHeaders,
      body: msgPayload,
    });
    assert(msgCreate.status === 201 && msgCreate.data.id, "POST /api/messages saves message to local JSON and MongoDB");
    const messageId = msgCreate.data.id;

    // Direct JSON file check
    const jsonPath = path.join(process.env.DATA_DIR, "messages.json");
    assert(fs.existsSync(jsonPath), "Local JSON file data/messages.json exists on disk");
    const fileRecords = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert(fileRecords.some((m) => m.id === messageId), "Disk audit: message persisted directly inside messages.json");

    // 2. GET All Messages
    const msgList = await request("/api/messages");
    assert(msgList.status === 200 && msgList.data.some((m) => m.id === messageId), "GET /api/messages reads from messages.json");

    // 3. GET Single Message
    const msgSingle = await request(`/api/messages/${messageId}`);
    assert(msgSingle.status === 200 && msgSingle.data.subject === "Lab Evaluation In Progress", "GET /api/messages/:id reads single message from JSON");

    // 4. PUT Message (Update)
    const msgPut = await request(`/api/messages/${messageId}`, {
      method: "PUT",
      body: {
        subject: "Updated Evaluation Note",
        message: "Successfully verified JSON file update operations.",
      },
    });
    assert(msgPut.status === 200 && msgPut.data.subject === "Updated Evaluation Note", "PUT /api/messages/:id updates record in messages.json");

    // Check disk after update
    const updatedFileRecords = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const updatedRecord = updatedFileRecords.find((m) => m.id === messageId);
    assert(updatedRecord && updatedRecord.subject === "Updated Evaluation Note", "Disk audit: messages.json contains updated record");

    // 5. DELETE Message
    const msgDelete = await request(`/api/messages/${messageId}`, { method: "DELETE" });
    assert(msgDelete.status === 204, "DELETE /api/messages/:id deletes message from messages.json");

    const finalFileRecords = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert(!finalFileRecords.some((m) => m.id === messageId), "Disk audit: message removed from messages.json");

    console.log("\n--- TEST: External Weather API ---");
    const weather = await request("/api/weather?city=London");
    assert(weather.status === 200 && weather.data.city.includes("London"), "GET /api/weather?city=London fetches live data from Open-Meteo");

    console.log("\n=======================================================");
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log(`INTEGRATION SUITE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${results.length})`);
    console.log("=======================================================\n");

    if (failed > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error("Fatal Test Failure:", err);
    process.exit(1);
  } finally {
    await teardown();
  }
}

runTests();
