const mongoose = require('mongoose');
const generateHelper = require('../helper/generate');

const userSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  password: String,
  phone: String,
  tokenUser: {
    type: String,
    default: generateHelper.generateRandomString(20)
  },
  avatar: String,
  friendsList: [{
    user_id: String,
    room_chat_id: String
  }],
  invitationFriends: Array, // Lời mời kết bạn của người khác gửi cho mình
  requestFriends: Array, // Mình gửi yêu câu kết bạn cho ngừi khác
  statusOnline: String,
  status: {
    type: String,
    default: "active"
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema, 'users');
module.exports = User;