const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
    },
    preferences: {
      dark: { type: Boolean, default: false },
      lang: { type: String, default: "en" },
      unit: { type: String, default: "C" },
      emailNotif: { type: Boolean, default: true },
      deviceNotif: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Never expose passwordHash when converting to JSON
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
