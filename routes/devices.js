const express = require("express");
const Device = require("../models/Device");
const { checkText } = require("../lib/validate");
const { requireDb } = require("../lib/db");

const router = express.Router();

router.use(requireDb);

function present(device) {
  return {
    id: device._id,
    name: device.name,
    room: device.room,
    type: device.type,
    isOn: device.isOn,
    createdAt: device.createdAt,
  };
}

router.get("/", async (req, res) => {
  const devices = await Device.find().sort({ createdAt: 1 });
  res.json(devices.map(present));
});

router.get("/:id", async (req, res) => {
  const device = await Device.findById(req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });
  res.json(present(device));
});

router.post("/", async (req, res) => {
  const { name, room, type } = req.body || {};
  const error =
    checkText(name, "Device name", 40) ||
    checkText(room, "Room", 40) ||
    checkText(type, "Device type", 30);
  if (error) return res.status(400).json({ error });

  const device = await Device.create({
    name: name.trim(),
    room: room.trim(),
    type: type.trim(),
    isOn: false,
  });

  res.status(201).json(present(device));
});

router.patch("/:id", async (req, res) => {
  const device = await Device.findById(req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });

  const { name, room, type, isOn } = req.body || {};
  const hasUpdate = name !== undefined || room !== undefined || type !== undefined || isOn !== undefined;
  if (!hasUpdate) return res.status(400).json({ error: "Nothing to update" });

  if (name !== undefined) {
    const error = checkText(name, "Device name", 40);
    if (error) return res.status(400).json({ error });
    device.name = name.trim();
  }
  if (room !== undefined) {
    const error = checkText(room, "Room", 40);
    if (error) return res.status(400).json({ error });
    device.room = room.trim();
  }
  if (type !== undefined) {
    const error = checkText(type, "Device type", 30);
    if (error) return res.status(400).json({ error });
    device.type = type.trim();
  }
  if (isOn !== undefined) {
    if (typeof isOn !== "boolean") {
      return res.status(400).json({ error: "isOn must be true or false" });
    }
    device.isOn = isOn;
  }

  await device.save();
  res.json(present(device));
});

router.delete("/:id", async (req, res) => {
  const device = await Device.findByIdAndDelete(req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });
  res.status(204).end();
});

module.exports = router;
