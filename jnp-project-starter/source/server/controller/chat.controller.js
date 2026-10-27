const Chat = require('../model/chat.model');
const User = require('../model/user.model');
const RoomChat = require('../model/room-chat.model.js');
const chatSocket = require('../socket/chat.socket');

module.exports.index = async (req, res) => {
  // Chat socket
  chatSocket(req, res);
  // Chat socket

  const roomChatId = req.params.roomChatId;
  // console.log(roomChatId);
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

  // Lấy ra Room Chat theo id
  const myRoomChat = await RoomChat.findOne({
    _id: roomChatId,
    deleted: false
  });

  if (myRoomChat.typeRoom === "friend") {
    const friendId = myRoomChat.users.find(user => user.user_id != myUser.id)?.user_id;
    const friend = await User.findOne({
      _id: friendId
    });
    myRoomChat.avatar = friend.avatar || "/client/images/avatar.jpg"
    myRoomChat.title = friend.fullName;
    myRoomChat.statusOnlineFriend = friend.statusOnline;
  } else if (myRoomChat.typeRoom === "group") {
    if (!myRoomChat.avatar) {
      myRoomChat.avatar = "/client/images/group-avatar.png"
    }
  }
  // Hết lấy ra Room Chat theo id

  // Chat
  let chats = await Chat.find({
    deleted: false,
    room_chat_id: roomChatId
  });

  // console.log(chats);
  for (const chat of chats) {
    const infoUser = await User.findOne({
      _id: chat.user_id
    }).select("fullName");
    chat.fullName = infoUser.fullName;
  }
  // End Chat

  res.render("client/pages/chat/index.pug", {
    pageTitle: "Trang chủ",
    roomChatList: roomChatList,
    chats: chats,
    myRoomChat: myRoomChat
  });
}