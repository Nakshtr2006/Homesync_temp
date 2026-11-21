const path = require("path");
const fs = require("fs");

const rootEnv = path.resolve(__dirname, "../.env");
const backendEnv = path.resolve(__dirname, ".env");

if (fs.existsSync(rootEnv)) {
  require("dotenv").config({ path: rootEnv });
} else if (fs.existsSync(backendEnv)) {
  require("dotenv").config({ path: backendEnv });
}

const app = require("./src/app");
const { startServer } = require("./src/index");

if (require.main === module) {
  startServer();
}

module.exports = app;
