const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  room: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  isOn: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Device", deviceSchema);
