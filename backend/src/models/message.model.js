const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
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
      lowercase: true,
      trim: true,
      maxlength: 80,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 2000,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.Message || mongoose.model("Message", messageSchema);
