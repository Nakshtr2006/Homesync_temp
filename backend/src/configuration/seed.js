const User = require("../models/user.model");
const Room = require("../models/room.model");
const Device = require("../models/device.model");
const { hashPassword } = require("../utils/password");

async function seedIfEmpty() {
  try {
    let admin = await User.findOne({ email: "admin@homesync.com" });
    if (!admin) {
      const passwordHash = await hashPassword("Password123");
      admin = await User.create({
        name: "Arjan Khandelwal",
        email: "admin@homesync.com",
        passwordHash,
      });
      console.log("[Seed] Default user created: admin@homesync.com (Password123)");
    }

    const roomCount = await Room.countDocuments({ userId: admin._id });
    if (roomCount === 0) {
      await Room.insertMany([
        { name: "Living Room", userId: admin._id },
        { name: "Bedroom", userId: admin._id },
        { name: "Kitchen", userId: admin._id },
      ]);

      await Device.insertMany([
        { name: "Smart TV", room: "Living Room", type: "TV", isOn: false, userId: admin._id },
        { name: "Lamp", room: "Bedroom", type: "Light", isOn: true, userId: admin._id },
        { name: "AC", room: "Bedroom", type: "AC", isOn: false, userId: admin._id },
        { name: "Heater", room: "Kitchen", type: "Heater", isOn: false, userId: admin._id },
      ]);
      console.log("[Seed] Added sample rooms and devices for admin user");
    }
  } catch (err) {
    console.warn("[Seed] Seeding skipped or encountered error:", err.message);
  }
}

module.exports = { seedIfEmpty };
