const User = require("../models/user.model");
const Room = require("../models/room.model");
const Device = require("../models/device.model");
const { checkText, checkEmail, checkPassword } = require("../utils/validation");
const { hashPassword, verifyPassword } = require("../utils/password");
const { generateToken } = require("../utils/token");

async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    const validationError =
      checkText(name, "Name", 60) || checkEmail(email) || checkPassword(password);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    // Seed default rooms for the new user
    const defaultRooms = await Room.insertMany([
      { name: "Living Room", userId: user._id },
      { name: "Bedroom", userId: user._id },
      { name: "Kitchen", userId: user._id },
    ]);

    // Seed initial sample devices for the new user
    await Device.insertMany([
      { name: "Smart TV", room: "Living Room", type: "TV", isOn: false, userId: user._id },
      { name: "Lamp", room: "Bedroom", type: "Light", isOn: true, userId: user._id },
      { name: "AC", room: "Bedroom", type: "AC", isOn: false, userId: user._id },
      { name: "Heater", room: "Kitchen", type: "Heater", isOn: false, userId: user._id },
    ]);

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    res.status(201).json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      token,
      preferences: user.preferences,
      createdAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || checkEmail(email) || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Enter your email and password" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      token,
      preferences: user.preferences,
      createdAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signup,
  login,
  getCurrentUser,
};
