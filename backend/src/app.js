const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { CLIENT_ORIGIN } = require("./configuration/constants");
const { mongoReady, getLastConnectionError } = require("./configuration/database");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const deviceRoutes = require("./routes/device.routes");
const roomRoutes = require("./routes/room.routes");
const messageRoutes = require("./routes/message.routes");
const weatherRoutes = require("./routes/weather.routes");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

const allowedOrigins = [
  CLIENT_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));

// Health Check API
app.get("/api/health", (req, res) => {
  const isMongoReady = mongoReady();
  const dbName = isMongoReady ? mongoose.connection.name : null;
  const host = isMongoReady ? mongoose.connection.host : null;
  const readyState = mongoose.connection.readyState;
  const lastErr = getLastConnectionError();
  res.json({
    status: "HomeSync API is running",
    mongo: isMongoReady,
    database: isMongoReady ? "connected" : "disconnected",
    databaseName: dbName,
    clusterHost: host,
    readyState: readyState,
    error: isMongoReady ? null : lastErr,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/weather", weatherRoutes);

// Static frontend serving
// Looks in project root (or wherever frontend files live)
const frontendDir = path.resolve(__dirname, "../../");

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
    res.sendFile(path.join(frontendDir, file));
  });
});

// Also serve static assets if any
app.use(express.static(frontendDir));

// 404 and Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
