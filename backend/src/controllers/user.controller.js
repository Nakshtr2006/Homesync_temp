const User = require("../models/user.model");
const Device = require("../models/device.model");
const Room = require("../models/room.model");
const { checkText, checkEmail, checkPassword, isValidObjectId } = require("../utils/validation");
const { hashPassword, verifyPassword } = require("../utils/password");

async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const { name, email, currentPassword } = req.body || {};
    const validationError = checkText(name, "Name", 60) || checkEmail(email);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Authorization check: Verify current password if provided or user identity
    if (typeof currentPassword !== "string" || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newEmail = email.trim().toLowerCase();
    const emailTaken = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
    if (emailTaken) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    user.name = name.trim();
    user.email = newEmail;
    await user.save();

    res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const { currentPassword, newPassword } = req.body || {};
    const validationError = checkPassword(newPassword);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (typeof currentPassword !== "string" || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }

    const { dark, lang, unit, emailNotif, deviceNotif } = req.body || {};
    user.preferences = user.preferences || {};

    if (dark !== undefined) user.preferences.dark = Boolean(dark);
    if (lang !== undefined) user.preferences.lang = String(lang);
    if (unit !== undefined) user.preferences.unit = String(unit);
    if (emailNotif !== undefined) user.preferences.emailNotif = Boolean(emailNotif);
    if (deviceNotif !== undefined) user.preferences.deviceNotif = Boolean(deviceNotif);

    await user.save();
    res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
}

async function deleteAccount(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const { currentPassword } = req.body || {};
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (typeof currentPassword !== "string" || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Cascade delete user's devices and rooms
    await Device.deleteMany({ userId: user._id });
    await Room.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(id);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUserById,
  updateProfile,
  changePassword,
  updatePreferences,
  deleteAccount,
};
