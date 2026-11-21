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
  process.env.CLIENT_ORIGIN,
  CLIENT_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]
  .flatMap((o) => (o ? o.split(",") : []))
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow server-to-server, health probes, curl, Postman (requests without browser origin)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.replace(/\/+$/, "");

    // 2. Allow if wildcard * is configured
    if (allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    // 3. Allow exact match (e.g. deployed Vercel frontend URL)
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // 4. Support Vercel preview/production deployments matching .vercel.app
    const isVercelDomain =
      cleanOrigin.endsWith(".vercel.app") &&
      allowedOrigins.some((o) => o.includes("vercel.app") || o.includes("vercel"));
    if (isVercelDomain) {
      return callback(null, true);
    }

    // 5. Permissive in non-production local development
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    console.warn(`[CORS] Request blocked from origin: ${origin}`);
    const corsErr = new Error(`CORS Error: Origin '${origin}' is not allowed by CLIENT_ORIGIN.`);
    corsErr.status = 403;
    return callback(corsErr);
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
// Support preflight OPTIONS requests across all routes
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "10kb" }));

// Health Check API
app.get("/api/health", (req, res) => {
  const isMongoReady = mongoReady();
  const dbName = isMongoReady ? mongoose.connection.name : null;
  const host = isMongoReady ? mongoose.connection.host : null;
  const readyState = mongoose.connection.readyState;
  const lastErr = getLastConnectionError();
  const statusCode = isMongoReady ? 200 : 503;

  res.status(statusCode).json({
    status: isMongoReady ? "HomeSync API is running" : "HomeSync API starting: database disconnected",
    mongo: isMongoReady,
    database: isMongoReady ? "connected" : "disconnected",
    databaseName: dbName,
    clusterHost: host,
    readyState: readyState,
    error: isMongoReady ? null : lastErr,
    environment: process.env.NODE_ENV || "development",
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
  "/config.js": "config.js",
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
