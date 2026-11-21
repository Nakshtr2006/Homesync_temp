const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      maxlength: 40,
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

// Index room name per user
roomSchema.index({ userId: 1, name: 1 });

roomSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.Room || mongoose.model("Room", roomSchema);
