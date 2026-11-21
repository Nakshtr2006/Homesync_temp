const path = require("path");
const fs = require("fs");

const rootEnv = path.resolve(__dirname, "../../.env");
const backendEnv = path.resolve(__dirname, "../.env");

if (fs.existsSync(rootEnv)) {
  require("dotenv").config({ path: rootEnv });
} else if (fs.existsSync(backendEnv)) {
  require("dotenv").config({ path: backendEnv });
}

const app = require("./app");
const { PORT } = require("./configuration/constants");
const { connectDb, closeDb } = require("./configuration/database");
const { seedIfEmpty } = require("./configuration/seed");

async function startServer() {
  console.log("=========================================");
  console.log("           HomeSync Backend Server       ");
  console.log("=========================================");

  try {
    const dbConnected = await connectDb();
    if (dbConnected) {
      await seedIfEmpty();
    } else {
      console.warn("[Server] Warning: Server started without active MongoDB connection.");
    }

    const serverPort = process.env.PORT || PORT || 3000;
    const server = await new Promise((resolve, reject) => {
      const s = app.listen(serverPort, () => {
        console.log(`[Server] HomeSync server running at http://localhost:${serverPort}`);
        console.log(`[Server] Health check available at http://localhost:${serverPort}/api/health`);
        resolve(s);
      });
      s.on("error", reject);
    });

    const shutdown = async () => {
      console.log("\n[Server] Gracefully shutting down...");
      server.close(async () => {
        await closeDb();
        console.log("[Server] Closed server and database connections. Exiting.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    return server;
  } catch (err) {
    console.error("[Server] Fatal startup error:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
