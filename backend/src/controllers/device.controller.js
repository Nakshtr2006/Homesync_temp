const Device = require("../models/device.model");
const User = require("../models/user.model");
const { checkText, isValidObjectId } = require("../utils/validation");

// Helper to get effective userId
async function getEffectiveUserId(req) {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  // Fallback to default/first user if available (for backwards compatibility)
  const defaultUser = await User.findOne().sort({ createdAt: 1 });
  return defaultUser ? defaultUser._id : null;
}

async function getDevices(req, res, next) {
  try {
    let targetUserId = req.user && req.user.id ? req.user.id : null;
    if (!targetUserId) {
      // For unauthenticated/guest/demo requests, scope to the default admin user
      const defaultUser = await User.findOne().sort({ createdAt: 1 });
      if (defaultUser) targetUserId = defaultUser._id;
    }

    const query = targetUserId ? { userId: targetUserId } : {};
    const devices = await Device.find(query).sort({ createdAt: 1 });
    res.json(devices.map((d) => d.toJSON()));
  } catch (err) {
    next(err);
  }
}

async function getDeviceById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const query = { _id: id };
    if (req.user && req.user.id) {
      query.userId = req.user.id;
    }

    const device = await Device.findOne(query);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(device.toJSON());
  } catch (err) {
    next(err);
  }
}

async function createDevice(req, res, next) {
  try {
    const { name, room, type, isOn } = req.body || {};
    const validationError =
      checkText(name, "Device name", 40) ||
      checkText(room, "Room", 40) ||
      checkText(type, "Device type", 30);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    let userId = await getEffectiveUserId(req);
    if (!userId) {
      // Create a default user if none exists in database
      const defaultUser = await User.create({
        name: "HomeSync Admin",
        email: "admin@homesync.local",
        passwordHash: "default",
      });
      userId = defaultUser._id;
    }

    const device = await Device.create({
      name: name.trim(),
      room: room.trim(),
      type: type.trim(),
      isOn: Boolean(isOn),
      userId,
    });

    res.status(201).json(device.toJSON());
  } catch (err) {
    next(err);
  }
}

// Handles both PUT (full update) and PATCH (partial update)
async function updateDevice(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const query = { _id: id };
    if (req.user && req.user.id) {
      query.userId = req.user.id;
    }

    const device = await Device.findOne(query);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const { name, room, type, isOn } = req.body || {};
    const hasUpdate =
      name !== undefined || room !== undefined || type !== undefined || isOn !== undefined;
    if (!hasUpdate) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    if (name !== undefined) {
      const err = checkText(name, "Device name", 40);
      if (err) return res.status(400).json({ error: err });
      device.name = name.trim();
    }

    if (room !== undefined) {
      const err = checkText(room, "Room", 40);
      if (err) return res.status(400).json({ error: err });
      device.room = room.trim();
    }

    if (type !== undefined) {
      const err = checkText(type, "Device type", 30);
      if (err) return res.status(400).json({ error: err });
      device.type = type.trim();
    }

    if (isOn !== undefined) {
      if (typeof isOn !== "boolean") {
        return res.status(400).json({ error: "isOn must be true or false" });
      }
      device.isOn = isOn;
    }

    await device.save();
    res.json(device.toJSON());
  } catch (err) {
    next(err);
  }
}

async function deleteDevice(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const query = { _id: id };
    if (req.user && req.user.id) {
      query.userId = req.user.id;
    }

    const device = await Device.findOneAndDelete(query);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
};
