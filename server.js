require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const devicesRouter = require("./routes/devices");
const roomsRouter = require("./routes/rooms");
const usersRouter = require("./routes/users");
const messagesRouter = require("./routes/messages");
const weatherRouter = require("./routes/weather");
const { connectDb, mongoReady } = require("./lib/db");
const { seedIfEmpty } = require("./lib/seed");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
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
    res.sendFile(path.join(__dirname, file));
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Request body must be valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request is too large" });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

connectDb()
  .then((connected) => {
    if (connected) return seedIfEmpty();
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`HomeSync is running at http://localhost:${port}`);
    });
  });
