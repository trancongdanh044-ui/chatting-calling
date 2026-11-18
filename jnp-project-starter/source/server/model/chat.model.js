const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    user_id: String,
    room_chat_id: String,
    content: String,
    images: Array,
    files: Array,
    type: {
      type: String,
      enum: ["message", "call"],
      default: "message"
    },
    callInfo: {
      callType: {
        type: String, // "audio" | "video"
        default: "video"
      },
      status: {
        type: String, // "completed" | "missed" | "rejected"
        default: "missed"
      },
      duration: {
        type: Number, // tính bằng giây
        default: 0
      }
    },
    // ----------------
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  {
    timestamps: true
  }
);

const Chat = mongoose.model("Chat", chatSchema, "chats");
module.exports = Chat;