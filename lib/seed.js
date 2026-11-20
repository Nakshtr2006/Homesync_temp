const Device = require("../models/Device");
const Room = require("../models/Room");

async function seedIfEmpty() {
  const roomCount = await Room.countDocuments();
  if (roomCount > 0) return;

  await Room.insertMany([
    { name: "Living Room" },
    { name: "Bedroom" },
    { name: "Kitchen" },
  ]);

  await Device.insertMany([
    { name: "Smart TV", room: "Living Room", type: "TV", isOn: false },
    { name: "Lamp", room: "Bedroom", type: "Light", isOn: true },
    { name: "AC", room: "Bedroom", type: "AC", isOn: false },
    { name: "Heater", room: "Kitchen", type: "Heater", isOn: false },
  ]);

  console.log("Added sample rooms and devices");
}

module.exports = { seedIfEmpty };
