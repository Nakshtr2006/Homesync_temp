const express = require("express");
const {
  getMessages,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
} = require("../controllers/message.controller");
const { optionalAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(optionalAuth);

router.get("/", getMessages);
router.get("/:id", getMessageById);
router.post("/", createMessage);
router.put("/:id", updateMessage);
router.delete("/:id", deleteMessage);

module.exports = router;
