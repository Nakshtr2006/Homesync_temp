const express = require("express");
const Room = require("../models/Room");
const Device = require("../models/Device");
const { checkText } = require("../lib/validate");
const { requireDb } = require("../lib/db");

const router = express.Router();

router.use(requireDb);

async function withCounts(rooms) {
  const devices = await Device.find();
  return rooms.map((room) => ({
    id: room._id,
    name: room.name,
    createdAt: room.createdAt,
    deviceCount: devices.filter((device) => device.room === room.name).length,
  }));
}

function findDuplicate(rooms, name, ignoreId) {
  const wanted = name.toLowerCase();
  return rooms.find((room) => {
    if (ignoreId && String(room._id) === String(ignoreId)) return false;
    return room.name.toLowerCase() === wanted;
  });
}

router.get("/", async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: 1 });
  res.json(await withCounts(rooms));
});

router.get("/:id", async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  const deviceCount = await Device.countDocuments({ room: room.name });
  res.json({ id: room._id, name: room.name, createdAt: room.createdAt, deviceCount });
});

router.post("/", async (req, res) => {
  const { name } = req.body || {};
  const error = checkText(name, "Room name", 40);
  if (error) return res.status(400).json({ error });

  const trimmed = name.trim();
  const rooms = await Room.find();
  if (findDuplicate(rooms, trimmed)) {
    return res.status(409).json({ error: "A room with this name already exists" });
  }

  const room = await Room.create({ name: trimmed });
  res.status(201).json({ id: room._id, name: room.name, createdAt: room.createdAt, deviceCount: 0 });
});

router.patch("/:id", async (req, res) => {
  const { name } = req.body || {};
  const error = checkText(name, "Room name", 40);
  if (error) return res.status(400).json({ error });

  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const trimmed = name.trim();
  const rooms = await Room.find();
  if (findDuplicate(rooms, trimmed, room._id)) {
    return res.status(409).json({ error: "A room with this name already exists" });
  }

  const previousName = room.name;
  room.name = trimmed;
  await room.save();

  if (previousName !== trimmed) {
    await Device.updateMany({ room: previousName }, { room: trimmed });
  }

  const deviceCount = await Device.countDocuments({ room: trimmed });
  res.json({ id: room._id, name: room.name, createdAt: room.createdAt, deviceCount });
});

router.delete("/:id", async (req, res) => {
  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.status(204).end();
});

module.exports = router;
