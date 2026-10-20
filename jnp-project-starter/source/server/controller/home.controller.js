const Chat = require('../model/chat.model');
const User = require('../model/user.model');
const chatSocket = require('../socket/chat.socket');

module.exports.index = async (req, res) => {
  // Chat socket
  chatSocket(req, res);
  // Chat socket

  // const roomChatId = req.params.roomChatId;
  // Friend List
  const myUser = res.locals.myUser;
  const friendIds = myUser.friendsList.map((friend) => friend.id);
  let friendsList = await User.find({
    _id: {
      $in: friendIds
    }
  }).select("-password -tokenUser");
  // End Friend List

  // Chat
  let chats = await Chat.find({
    deleted: false,
    // room_chat_id: roomChatId
  });

  for(const chat of chats){
    const infoUser = await User.findOne({
      _id: chat.user_id
    }).select("fullName");
    chat.fullName = infoUser.fullName;
  }
  // End Chat

  res.render("client/pages/home/index.pug", {
    pageTitle: "Trang chủ",
    friendsList: friendsList,
    chats: chats
  });
}