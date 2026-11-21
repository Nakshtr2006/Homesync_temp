const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Message = require("../models/message.model");
const { mongoReady } = require("../configuration/database");
const { DATA_DIR } = require("../configuration/constants");
const { checkText, checkEmail } = require("../utils/validation");

function getMessagesFilePath() {
  const dir = process.env.DATA_DIR || DATA_DIR;
  return path.join(dir, "messages.json");
}

function readMessagesFromFile() {
  const filePath = getMessagesFilePath();
  if (!fs.existsSync(filePath)) {
    // Try root fallback
    const fallback = path.resolve(__dirname, "../../../data/messages.json");
    if (fs.existsSync(fallback)) {
      try {
        return JSON.parse(fs.readFileSync(fallback, "utf8").trim() || "[]");
      } catch (err) {
        return [];
      }
    }
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[MessagesStorage] Read error from ${filePath}:`, err.message);
    return [];
  }
}

function writeMessagesToFile(messages) {
  const filePath = getMessagesFilePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const content = JSON.stringify(messages, null, 2);
  const tempFile = `${filePath}.tmp`;

  try {
    fs.writeFileSync(tempFile, content, "utf8");
    fs.renameSync(tempFile, filePath);
  } catch (err) {
    // Windows file-locking workaround: fallback to direct write
    try {
      fs.writeFileSync(filePath, content, "utf8");
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  }

  // Also sync to root data directory if different
  const rootDataDir = path.resolve(__dirname, "../../../data");
  if (path.resolve(dir) !== rootDataDir) {
    try {
      fs.mkdirSync(rootDataDir, { recursive: true });
      const rootFile = path.join(rootDataDir, "messages.json");
      fs.writeFileSync(rootFile, content, "utf8");
    } catch (e) {
      // Non-critical
    }
  }
}

async function getMessages(req, res, next) {
  try {
    const messages = readMessagesFromFile();
    // Return all or filtered
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

async function getMessageById(req, res, next) {
  try {
    const { id } = req.params;
    const messages = readMessagesFromFile();
    const found = messages.find((m) => String(m.id) === String(id));
    if (!found) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(found);
  } catch (err) {
    next(err);
  }
}

async function createMessage(req, res, next) {
  try {
    const { name, email, subject, message } = req.body || {};
    const validationError =
      checkText(name, "Name", 60) ||
      checkEmail(email) ||
      checkText(subject, "Subject", 100) ||
      checkText(message, "Message", 2000);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const createdAt = new Date().toISOString();

    const newRecord = {
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      createdAt,
    };

    // 1. Save to local JSON storage
    const messages = readMessagesFromFile();
    messages.push(newRecord);
    writeMessagesToFile(messages);

    // 2. Mirror into MongoDB Message collection if connected
    if (mongoReady()) {
      try {
        await Message.create({
          name: newRecord.name,
          email: newRecord.email,
          subject: newRecord.subject,
          message: newRecord.message,
          userId: req.user && req.user.id ? req.user.id : null,
          createdAt: new Date(createdAt),
        });
      } catch (mongoErr) {
        console.warn("[MessagesStorage] Mirroring to MongoDB failed:", mongoErr.message);
      }
    }

    res.status(201).json(newRecord);
  } catch (err) {
    next(err);
  }
}

async function updateMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, subject, message } = req.body || {};
    const messages = readMessagesFromFile();
    const index = messages.findIndex((m) => String(m.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (name !== undefined) {
      const err = checkText(name, "Name", 60);
      if (err) return res.status(400).json({ error: err });
      messages[index].name = name.trim();
    }
    if (email !== undefined) {
      const err = checkEmail(email);
      if (err) return res.status(400).json({ error: err });
      messages[index].email = email.trim().toLowerCase();
    }
    if (subject !== undefined) {
      const err = checkText(subject, "Subject", 100);
      if (err) return res.status(400).json({ error: err });
      messages[index].subject = subject.trim();
    }
    if (message !== undefined) {
      const err = checkText(message, "Message", 2000);
      if (err) return res.status(400).json({ error: err });
      messages[index].message = message.trim();
    }
    messages[index].updatedAt = new Date().toISOString();

    writeMessagesToFile(messages);

    // Mirror update to MongoDB if found
    if (mongoReady()) {
      try {
        await Message.findOneAndUpdate(
          { email: messages[index].email, subject: messages[index].subject },
          { $set: messages[index] }
        );
      } catch (e) {
        // Ignore
      }
    }

    res.json(messages[index]);
  } catch (err) {
    next(err);
  }
}

async function deleteMessage(req, res, next) {
  try {
    const { id } = req.params;
    const messages = readMessagesFromFile();
    const index = messages.findIndex((m) => String(m.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ error: "Message not found" });
    }

    const [deleted] = messages.splice(index, 1);
    writeMessagesToFile(messages);

    // Mirror delete to MongoDB
    if (mongoReady()) {
      try {
        await Message.findOneAndDelete({ email: deleted.email, subject: deleted.subject });
      } catch (e) {
        // Ignore
      }
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMessages,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
};
