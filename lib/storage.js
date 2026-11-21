const fs = require("fs");
const path = require("path");
const os = require("os");

const defaultDataDir = path.join(__dirname, "..", "data");
// On Vercel serverless environment, use /tmp since root directory is read-only
const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "homesync-data") : defaultDataDir);

function filePathFor(name) {
  return path.join(dataDir, `${name}.json`);
}

function readRecords(name) {
  let file = filePathFor(name);
  if (!fs.existsSync(file)) {
    // If not yet in writable dataDir (e.g. /tmp on Vercel), read bundled default data
    const fallbackFile = path.join(defaultDataDir, `${name}.json`);
    if (fs.existsSync(fallbackFile)) {
      file = fallbackFile;
    } else {
      return [];
    }
  }
  try {
    const content = fs.readFileSync(file, "utf8").trim();
    if (!content) return [];
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err.message);
    return [];
  }
}

// Write to a temp file first so a crash mid-write cannot leave a broken JSON file.
function writeRecords(name, records) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const file = filePathFor(name);
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(records, null, 2));
    fs.renameSync(tempFile, file);
  } catch (err) {
    // If writing fails with EROFS (read-only filesystem on Vercel serverless), write to /tmp
    if (err.code === "EROFS" || (err.message && err.message.includes("read-only"))) {
      const tmpDir = path.join(os.tmpdir(), "homesync-data");
      fs.mkdirSync(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, `${name}.json`);
      fs.writeFileSync(`${tmpFile}.tmp`, JSON.stringify(records, null, 2));
      fs.renameSync(`${tmpFile}.tmp`, tmpFile);
    } else {
      throw err;
    }
  }
}

module.exports = { readRecords, writeRecords };
