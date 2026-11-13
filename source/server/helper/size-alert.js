const User = require('../model/user.model');

module.exports.lengthOfInviation = async(userId, socket) => {
  const user = await User.findOne({
    _id: userId
  });
  const lengthOfInvitation = user.invitationFriends.length;
  socket.broadcast.emit("SERVER_RETURN_LENGTH_INVITATION", {
    userId: userId,
    lengthOfInvitation: lengthOfInvitation
  });
}

module.exports.lengthOfInviationWithEmit = async(userId, socket) => {
  const user = await User.findOne({
    _id: userId
  });
  const lengthOfInvitation = user.invitationFriends.length;
  socket.emit("SERVER_RETURN_LENGTH_INVITATION", {
    userId: userId,
    lengthOfInvitation: lengthOfInvitation
  });
}

module.exports.lengthOfFriendList = async(userId, socket) => {
  const user = await User.findOne({
    _id: userId
  });
  const lengthOfFriendList = user.friendsList.length;
  socket.emit("SERVER_RETURN_LENGTH_FRIEND_LIST", {
    lengthOfFriendList: lengthOfFriendList
  });
}

module.exports.lengthOfRequets = async (userId, socket) => {
  const user = await User.findOne({
    _id: userId
  });
  const lengthOfRequest = user.requestFriends.length;
  socket.emit("SERVER_RETURN_LENGTH_REQUEST", {
    lengthOfRequest: lengthOfRequest
  });
}

// SERVER_RETURN_LENGTH_INVITATION