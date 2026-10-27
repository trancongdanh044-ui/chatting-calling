const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model');

module.exports.index = async (req, res) => {

  // Room Chat List
  const myUser = res.locals.myUser;
  const roomChatList = await RoomChat.find({
    deleted: false,
    "users.user_id": myUser.id
  });
  // console.log(roomChatList);

  for (const roomChat of roomChatList) {
    if (roomChat.typeRoom === "friend") {
      const friendId = roomChat.users.find(user => user.user_id != myUser.id)?.user_id;
      const friend = await User.findOne({
        _id: friendId
      });
      roomChat.avatar = friend.avatar || "/client/images/avatar.jpg"
      roomChat.title = friend.fullName;
      roomChat.statusOnlineFriend = friend.statusOnline;
    } else if (roomChat.typeRoom === "group") {
      if (!roomChat.avatar) {
        roomChat.avatar = "/client/images/group-avatar.png"
      }
    }
  }
  // End Room Chat List

  res.render("client/pages/home/index.pug", {
    pageTitle: "Trang chủ",
    roomChatList: roomChatList
  });
}