const express = require("express");
const {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
} = require("../controllers/room.controller");
const { optionalAuth } = require("../middleware/auth.middleware");
const { requireDb } = require("../configuration/database");

const router = express.Router();

router.use(requireDb);
router.use(optionalAuth);

router.get("/", getRooms);
router.get("/:id", getRoomById);
router.post("/", createRoom);
router.put("/:id", updateRoom);
router.patch("/:id", updateRoom);
router.delete("/:id", deleteRoom);

module.exports = router;
