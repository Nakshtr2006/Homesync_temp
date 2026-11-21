const path = require("path");
const fs = require("fs");

const rootEnv = path.resolve(__dirname, ".env");
if (fs.existsSync(rootEnv)) {
  require("dotenv").config({ path: rootEnv });
}

const app = require("./backend/src/app");
const { startServer } = require("./backend/src/index");

if (require.main === module) {
  startServer();
}

module.exports = app;
