const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model');

// [GET] /chat
module.exports.index = async (req, res) => {
  try {
    // Room Chat List
    const myUser = res.locals.myUser;
    let roomChatList = await RoomChat.find({
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
        roomChat.friendId = friendId;
      } else if (roomChat.typeRoom === "group") {
        if (!roomChat.avatar) {
          roomChat.avatar = "/client/images/group-avatar.png"
        }
      }
    }
    // console.log(roomChatList);
    // End Room Chat List

    // Search
    if (req.query.keyword) {
      const keyword = req.query.keyword;
      const keywordRegex = new RegExp(keyword, "i");
      roomChatList = roomChatList.filter((room) => {
        return keywordRegex.test(room.title);
      });
      console.log(roomChatList);
    }
    // End Search

    res.render("client/pages/chat/index.pug", {
      pageTitle: "Trang chủ",
      roomChatList: roomChatList
    });
  } catch (error) {
    console.log(error);
  }
}