const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Device name is required"],
      trim: true,
      maxlength: 40,
    },
    room: {
      type: String,
      required: [true, "Room is required"],
      trim: true,
      maxlength: 40,
    },
    type: {
      type: String,
      required: [true, "Device type is required"],
      trim: true,
      maxlength: 30,
    },
    isOn: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User association is required"],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

deviceSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.Device || mongoose.model("Device", deviceSchema);
