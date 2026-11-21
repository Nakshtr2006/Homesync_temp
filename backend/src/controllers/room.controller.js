const Room = require("../models/room.model");
const Device = require("../models/device.model");
const User = require("../models/user.model");
const { checkText, isValidObjectId } = require("../utils/validation");

// Helper to get effective userId
async function getEffectiveUserId(req) {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  const defaultUser = await User.findOne().sort({ createdAt: 1 });
  return defaultUser ? defaultUser._id : null;
}

async function getRooms(req, res, next) {
  try {
    let targetUserId = req.user && req.user.id ? req.user.id : null;
    if (!targetUserId) {
      // For unauthenticated/guest/demo requests, scope to the default admin user
      const defaultUser = await User.findOne().sort({ createdAt: 1 });
      if (defaultUser) targetUserId = defaultUser._id;
    }

    const query = targetUserId ? { userId: targetUserId } : {};
    const deviceQuery = targetUserId ? { userId: targetUserId } : {};

    const [rooms, devices] = await Promise.all([
      Room.find(query).sort({ createdAt: 1 }),
      Device.find(deviceQuery),
    ]);

    const result = rooms.map((room) => {
      const json = room.toJSON();
      json.deviceCount = devices.filter((d) => d.room === room.name).length;
      return json;
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getRoomById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const query = { _id: id };
    if (req.user && req.user.id) {
      query.userId = req.user.id;
    }

    const room = await Room.findOne(query);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const deviceQuery = { room: room.name };
    if (room.userId) {
      deviceQuery.userId = room.userId;
    }
    const deviceCount = await Device.countDocuments(deviceQuery);

    const json = room.toJSON();
    json.deviceCount = deviceCount;
    res.json(json);
  } catch (err) {
    next(err);
  }
}

async function createRoom(req, res, next) {
  try {
    const { name } = req.body || {};
    const validationError = checkText(name, "Room name", 40);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const trimmed = name.trim();
    let userId = await getEffectiveUserId(req);
    if (!userId) {
      const defaultUser = await User.create({
        name: "HomeSync Admin",
        email: "admin@homesync.local",
        passwordHash: "default",
      });
      userId = defaultUser._id;
    }

    // Check duplicate room name for this user (case-insensitive)
    const existingRooms = await Room.find({ userId });
    const isDuplicate = existingRooms.some(
      (r) => r.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(409).json({ error: "A room with this name already exists" });
    }

    const room = await Room.create({
      name: trimmed,
      userId,
    });

    const json = room.toJSON();
    json.deviceCount = 0;
    res.status(201).json(json);
  } catch (err) {
    next(err);
  }
}

// Handles both PUT and PATCH
async function updateRoom(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const { name } = req.body || {};
    const validationError = checkText(name, "Room name", 40);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const query = { _id: id };
    if (req.user && req.user.id) {
      query.userId = req.user.id;
    }

    const room = await Room.findOne(query);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const trimmed = name.trim();

    // Check duplicate
    const peerRooms = await Room.find({ userId: room.userId, _id: { $ne: room._id } });
    const isDuplicate = peerRooms.some(
      (r) => r.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(409).json({ error: "A room with this name already exists" });
    }

    const oldName = room.name;
    room.name = trimmed;
    await room.save();

    // Cascade update to devices if room name changed
    if (oldName !== trimmed) {
      const updateFilter = { room: oldName };
      if (room.userId) updateFilter.userId = room.userId;
      await Device.updateMany(updateFilter, { room: trimmed });
    }

    const deviceQuery = { room: trimmed };
    if (room.userId) deviceQuery.userId = room.userId;
    const deviceCount = await Device.countDocuments(deviceQuery);

    const json = room.toJSON();
    json.deviceCount = deviceCount;
    res.json(json);
  } catch (err) {
    next(err);
  }
}

async function deleteRoom(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const query = { _id: id };
    if (req.user && req.user.id) {
      query.userId = req.user.id;
    }

    const room = await Room.findOneAndDelete(query);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
};
