const mongoose = require('mongoose');

const roomChatSchema = new mongoose.Schema({
  title: String,
  avatar: String,
  theme: String,
  typeRoom: String,
  status: String,
  users: [{
    user_id: String,
    role: String
  }],
  deleted: {
    type: Boolean,
    default: false
  },
  deleteAt: Date,
  latestMessage: {
    user_id:  String,
    content: String,
    user_name: String
  }
},{timestamps: true});

const RoomChat = mongoose.model("RoomChat", roomChatSchema, "rooms-chat");
module.exports = RoomChat;